import React, { useState } from 'react';
import { Group, Line, Circle, Text, Rect } from 'react-konva';
import { ROOM_ACTIONS } from './ai-integration/roomGeometry.js';
import { BUILDING_LEVELS } from './ai-integration/roomSchedule.js';

export function RoomBoundaryPanel({ rooms, control, enabled, setEnabled, editing, setEditing, readOnly }) {
  const selected=rooms.filter(r=>r.selected);
  const [height, setHeight]=useState('');
  const apply=action=>selected.forEach(room=>control.update([room.id],{actions:[...new Set([...(room.actions||[]),action])],...(action==='Mark as Wet Area'?{wetArea:true}:{})}));
  return <aside data-testid="room-boundary-panel" style={{position:'absolute',right:12,top:12,zIndex:4,width:280,maxHeight:'70%',overflowY:'auto',padding:12,background:'#fff',border:'1px solid #94a3b8',borderRadius:8,boxShadow:'0 2px 12px #0002'}}>
    <strong>Interactive rooms</strong>
    <label style={{display:'block',margin:'8px 0'}}><input type="checkbox" checked={enabled} disabled={readOnly} onChange={e=>{setEnabled(e.target.checked);setEditing(null);}} /> Select rooms on plan</label>
    <button disabled={control.busy||readOnly} onClick={()=>{setEnabled(true);control.read();}}>{control.busy?'Detecting…':'Detect room boundaries'}</button>
    {control.message&&<p role="status">{control.message}</p>}
    <p>{selected.length} rooms selected · {selected.reduce((n,r)=>n+(r.areaM2||0),0).toFixed(2)} m²</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{ROOM_ACTIONS.map(action=><button key={action} disabled={!selected.length||readOnly} onClick={()=>apply(action)}>{action}</button>)}</div>
    <label style={{display:'block',marginTop:8}}>Wall finish height (m) <input aria-label="Room wall finish height" type="number" min="0.1" max="20" step="0.1" value={height} onChange={e=>setHeight(e.target.value)} style={{width:65}} /></label>
    <button disabled={!selected.length||!(Number(height)>0&&Number(height)<=20)||readOnly} onClick={()=>control.update(selected.map(r=>r.id),{wallHeightM:Number(height)})}>Apply height</button>
    <small style={{display:'block'}}>Wall areas are gross; allow for openings before ordering.</small>
    {rooms.map(room=><div key={room.id||room.name} data-room-id={room.id} style={{borderTop:'1px solid #e2e8f0',marginTop:8,paddingTop:8}}>
      <label><input type="checkbox" checked={!!room.selected} disabled={!room.id||readOnly} onChange={()=>control.update([room.id],{selected:!room.selected})} /> {room.name}</label>
      <div>{room.level} · {room.areaM2?.toFixed(2)??'—'} m² · {room.perimeterM?.toFixed(2)??'—'} m</div>
      <small style={{color:room.reviewRequired||!room.polygon?.length?'#a16207':'#166534'}}>{!room.polygon?.length?'Review: detect or redraw this boundary':room.reviewRequired?`Review: ${(room.reviewReasons||[]).join('; ')}`:`Confirmed geometry · ${Math.round((room.confidence||0)*100)}% confidence`}</small>
      {room.selected&&<div>
        <label style={{display:'block'}}>Room name <input aria-label={`Name for ${room.name}`} defaultValue={room.name} disabled={readOnly} onBlur={event=>{const name=event.target.value.trim().slice(0,60);if(name&&name!==room.name)control.update([room.id],{name});}} /></label>
        <label style={{display:'block'}}>Level <select aria-label={`Level for ${room.name}`} value={room.level||'Unassigned'} disabled={readOnly} onChange={event=>control.update([room.id],{level:event.target.value,levelId:event.target.value})}><option value="Unassigned">Confirm level</option>{BUILDING_LEVELS.map(level=><option key={level}>{level}</option>)}</select></label>
        <button disabled={readOnly} onClick={()=>{setEnabled(true);setEditing(editing===room.id?null:room.id);}}>{editing===room.id?'Finish editing':'Adjust / redraw'}</button>
        <button disabled={readOnly} onClick={()=>{setEditing(room.id);setEnabled(true);control.update([room.id],{polygon:[],confirmed:false});}}>Redraw boundary</button>
        <button disabled={!room.polygon?.length||readOnly} onClick={()=>control.update([room.id],{confirmed:true,boundaryClosed:true})}>Confirm boundary</button>
        <button disabled={readOnly} onClick={()=>control.update([room.id],{actions:[],wetArea:false})}>Clear actions</button>
        <small style={{display:'block'}}>{(room.actions||[]).join(', ')}</small>
        {!(room.wallHeightM>0)&&(room.actions||[]).some(action=>['Wall Tiling','Painting'].includes(action))&&<small style={{color:'#a16207'}}>Set a wall finish height to calculate wall quantities.</small>}
      </div>}
    </div>)}
    {editing&&<p>Drag corners. Double-click an edge to add a corner; right-click a corner to remove it. A room without a boundary can be redrawn by clicking its corners on the plan, then double-clicking to finish.</p>}
  </aside>;
}

export function RoomBoundaryLayer({ rooms, enabled, editing, control, scale, width, height, suppressClick }) {
  const [hovered,setHovered]=useState(null);
  const [draft,setDraft]=useState([]);
  const redraw=rooms.find(r=>r.id===editing&&!r.polygon?.length);
  const stop=e=>{e.cancelBubble=true;};
  const local=e=>e.target.getParent().getRelativePointerPosition();
  return <Group listening={enabled} name="room-boundaries">
    {rooms.filter(r=>r.polygon?.length>=3).map(room=><Group key={room.id}>
      <Line name={`room-boundary:${room.id}`} points={room.polygon.flatMap(p=>[p.x,p.y])} closed
        fill={room.selected?'rgba(37,99,235,0.35)':hovered===room.id?'rgba(14,165,233,0.28)':'rgba(255,255,255,0.01)'}
        stroke={room.reviewRequired?'#d97706':'#0284c7'} strokeWidth={(room.selected?3:1.5)/scale} dash={room.reviewRequired?[6/scale,4/scale]:[]}
        onMouseEnter={()=>setHovered(room.id)} onMouseLeave={()=>setHovered(null)}
        onClick={e=>{stop(e);if(suppressClick.current){suppressClick.current=false;return;}control.update([room.id],{selected:!room.selected});}}
        onDblClick={e=>{stop(e);if(editing!==room.id)return;const p=local(e);let best=0,distance=Infinity;room.polygon.forEach((a,i)=>{const b=room.polygon[(i+1)%room.polygon.length];const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2)));const d=Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y));if(d<distance){distance=d;best=i;}});const polygon=[...room.polygon];polygon.splice(best+1,0,p);control.update([room.id],{polygon,confirmed:false});}} />
      <Text x={room.polygon[0].x} y={room.polygon[0].y} text={`${room.name}\n${room.areaM2?.toFixed(2)??'—'} m² · ${room.perimeterM?.toFixed(2)??'—'} m`} fontSize={12/scale} fill="#0f172a" listening={false}/>
      {editing===room.id&&room.polygon.map((p,i)=><Circle key={i} name="room-vertex" x={p.x} y={p.y} radius={6/scale} fill="#fff" stroke="#2563eb" strokeWidth={2/scale} draggable
        onMouseDown={stop} onClick={stop} onDragStart={stop} onDragMove={stop}
        onDragEnd={e=>{stop(e);control.update([room.id],{polygon:room.polygon.map((q,j)=>j===i?{x:e.target.x(),y:e.target.y()}:q),confirmed:false});}}
        onContextMenu={e=>{e.evt.preventDefault();stop(e);if(room.polygon.length>3)control.update([room.id],{polygon:room.polygon.filter((_,j)=>i!==j),confirmed:false});}} />)}
    </Group>)}
    {redraw&&<><Rect width={width} height={height} fill="rgba(0,0,0,0.01)" onClick={e=>{stop(e);const p=local(e);setDraft(previous=>previous.length&&Math.hypot(previous.at(-1).x-p.x,previous.at(-1).y-p.y)<1?previous:[...previous,p]);}} onDblClick={e=>{stop(e);if(draft.length>=3){control.update([redraw.id],{polygon:draft,confirmed:false,boundaryClosed:false});setDraft([]);}}}/><Line points={draft.flatMap(p=>[p.x,p.y])} stroke="#2563eb" strokeWidth={2/scale} listening={false}/></>}
  </Group>;
}
