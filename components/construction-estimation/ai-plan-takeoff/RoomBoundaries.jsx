import React, { useMemo, useState } from 'react';
import { Group, Line, Circle, Text, Rect, Label, Tag } from 'react-konva';
import { ROOM_ACTIONS, approveRoom } from './ai-integration/roomGeometry.js';
import { BUILDING_LEVELS } from './ai-integration/roomSchedule.js';
import { roomDisplayColor, roomStatusAppearance } from './ai-integration/roomAppearance.js';
import { roomSnapTargets, snapRoomVertex, polygonAreaPerimeter, keepRoomCornerInside } from './roomSnapping.js';

const SNAP_TOLERANCE_SCREEN_PX = 12;

// Where a room's name goes: the point inside it furthest from its edges (an L-shaped room or a corridor is named
// inside itself, not at a corner where the walls and the next room's name are).
export function roomLabelPoint(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return null;
  const xs = polygon.map((p) => p.x), ys = polygon.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const inside = (p) => { let r = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) r = !r; } return r; };
  const edge = (p) => Math.min(...polygon.map((a, i) => { const b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }));
  let best = null;
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) for (let j = 0; j <= steps; j += 1) {
    const p = { x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * j / steps };
    if (!inside(p)) continue;
    const d = edge(p);
    if (!best || d > best.d) best = { ...p, d };
  }
  return best || { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length, d: 0 };
}

// The panel floats over the top-right of the drawing. While a tool that is used
// by clicking points on the plan is active (measure, eaves, openings, areas...)
// it folds to its header so it never sits on top of geometry being clicked; the
// builder can open or fold it at any time, and that choice holds for the tool.
export function RoomBoundaryPanel({ rooms, control, enabled, setEnabled, editing, setEditing, readOnly, hoveredId = null, setHoveredId = () => {}, toolKey = null, collapseForTool = false, onFocus = null, focusedId = null, outdoorAreas = [], onFocusArea = null, currentPage = null }) {
  const selected=rooms.filter(r=>r.selected&&!r.excluded);
  const [height, setHeight]=useState('');
  const [manual, setManual]=useState({ tool: null, collapsed: null });
  const collapsed=manual.tool===toolKey&&manual.collapsed!==null?manual.collapsed:collapseForTool;
  const toggle=()=>setManual({ tool: toolKey, collapsed: !collapsed });
  const apply=action=>selected.forEach(room=>control.update([room.id],{actions:[...new Set([...(room.actions||[]),action])],...(action==='Mark as Wet Area'?{wetArea:true}:{})}));
  const frame={position:'absolute',right:12,top:12,zIndex:4,padding:collapsed?'6px 10px':12,background:'#fff',border:'1px solid #94a3b8',borderRadius:8,boxShadow:'0 2px 12px #0002'};
  const header=<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
    <strong>Interactive rooms{collapsed?` (${rooms.length})`:''}</strong>
    <button type="button" data-testid="room-boundary-panel-toggle" aria-expanded={!collapsed} onClick={toggle}>{collapsed?'Show':'Hide'}</button>
  </div>;
  if(collapsed)return <aside data-testid="room-boundary-panel-collapsed" style={frame}>{header}</aside>;
  return <aside data-testid="room-boundary-panel" style={{...frame,width:320,maxHeight:'70%',overflowY:'auto'}}>
    {header}
    <label style={{display:'block',margin:'8px 0'}}><input type="checkbox" checked={enabled} disabled={readOnly} onChange={e=>{setEnabled(e.target.checked);setEditing(null);}} /> Select rooms on plan</label>
    <button disabled={control.busy||readOnly} onClick={()=>{setEnabled(true);control.read();}}>{control.busy?'Detecting…':'Detect room boundaries'}</button>
    <button data-testid="remeasure-rooms" disabled={control.busy||readOnly} onClick={()=>{setEnabled(true);control.remeasure();}}>Re-measure from walls</button>
    {control.message&&<p role="status">{control.message}</p>}
    <p>{selected.length} rooms selected · {selected.reduce((n,r)=>n+(r.areaM2||0),0).toFixed(2)} m²</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{ROOM_ACTIONS.map(action=><button key={action} disabled={!selected.length||readOnly} onClick={()=>apply(action)}>{action}</button>)}</div>
    <label style={{display:'block',marginTop:8}}>Wall finish height (m) <input aria-label="Room wall finish height" type="number" min="0.1" max="20" step="0.1" value={height} onChange={e=>setHeight(e.target.value)} style={{width:65}} /></label>
    <button disabled={!selected.length||!(Number(height)>0&&Number(height)<=20)||readOnly} onClick={()=>control.update(selected.map(r=>r.id),{wallHeightM:Number(height)})}>Apply height</button>
    <small style={{display:'block'}}>Wall areas are gross; allow for openings before ordering.</small>
    {[...rooms].sort((a,b)=>(a.page===currentPage?0:1)-(b.page===currentPage?0:1)||(a.page-b.page)).map(room=>{
      const locked=Boolean(room.boundaryLocked);
      const canApprove=!approveRoom(room).reviewRequired;
      return <div key={room.id||room.name} data-room-id={room.id}
        onMouseEnter={()=>setHoveredId(room.id)} onMouseLeave={()=>setHoveredId(null)}
        style={{borderTop:'1px solid #e2e8f0',marginTop:8,paddingTop:8,background:hoveredId===room.id?'#eff6ff':undefined}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <input type="checkbox" aria-label={`Select ${room.name}`} checked={!!room.selected} disabled={!room.id||room.excluded||readOnly} onChange={()=>control.update([room.id],{selected:!room.selected})} />
        <span style={{width:12,height:12,borderRadius:2,background:roomDisplayColor(room),display:'inline-block',flex:'none'}} />
        <button type="button" data-testid="room-focus" data-room-name={room.name} disabled={!onFocus||!room.polygon?.length}
          onClick={()=>onFocus&&onFocus(room,{centre:true})}
          style={{all:'unset',cursor:onFocus?'pointer':'default',fontWeight:focusedId===room.id?700:600,color:focusedId===room.id?'#1d4ed8':'#0f172a',flex:1}}>
          {room.name}</button>
        <strong style={{whiteSpace:'nowrap'}}>{room.areaM2?.toFixed(2)??'-'} m²</strong>
      </div>
      <div style={{fontSize:12,color:'#475569'}}>Sheet {room.page} · {room.level} · perimeter {room.perimeterM?.toFixed(2)??'-'} m</div>
      {/* One short line per room; the full reasons open on request, so the list stays readable. */}
      <small style={{color:room.reviewRequired||!room.polygon?.length?'#a16207':'#166534'}}>{!room.polygon?.length?'Review: detect or redraw this boundary':room.reviewRequired?`To check: ${(room.reviewReasons||[]).some(r=>/virtual divider|closed across|threshold|frame/i.test(r))?'a boundary with no wall (divider or opening)':'boundary and label'}`:locked?'Approved and locked - re-scans keep this boundary':room.confirmed?'Approved room':'Measured boundary - awaiting approval'}</small>
      {room.reviewRequired&&(room.reviewReasons||[]).length>0&&<details style={{fontSize:12,color:'#475569'}}><summary style={{cursor:'pointer'}}>Details</summary>{(room.reviewReasons||[]).map((reason,k)=><p key={k} style={{margin:'4px 0'}}>{reason}</p>)}</details>}
      {room.excluded&&<button disabled={readOnly} onClick={()=>control.update([room.id],{excluded:false,confirmed:false,approvalInputs:null})}>Restore boundary for review</button>}
      {room.selected&&!room.excluded&&<div>
        <label style={{display:'block'}}>Room colour <input type="color" aria-label={`Colour for ${room.name}`} value={roomDisplayColor(room)} disabled={readOnly} onChange={event=>control.update([room.id],{displayColor:event.target.value})} /></label>
        <label style={{display:'block'}}>Room name <input aria-label={`Name for ${room.name}`} defaultValue={room.name} disabled={readOnly} onBlur={event=>{const name=event.target.value.trim().slice(0,60);if(name&&name!==room.name)control.update([room.id],{name});}} /></label>
        <label style={{display:'block'}}>Level <select aria-label={`Level for ${room.name}`} value={room.level||'Unassigned'} disabled={readOnly} onChange={event=>control.update([room.id],{level:event.target.value,levelId:event.target.value})}><option value="Unassigned">Confirm level</option>{BUILDING_LEVELS.map(level=><option key={level}>{level}</option>)}</select></label>
        <button disabled={readOnly||locked} onClick={()=>{setEnabled(true);setEditing(editing===room.id?null:room.id);}}>{editing===room.id?'Finish editing':'Adjust / redraw'}</button>
        <button disabled={readOnly||locked} onClick={()=>{setEditing(room.id);setEnabled(true);control.update([room.id],{polygon:[],confirmed:false});}}>Redraw boundary</button>
        <button disabled={readOnly||!canApprove} onClick={()=>control.update([room.id],{confirmed:true,boundaryClosed:true})}>Approve room</button>
        {locked
          ? <button data-testid="unlock-room-boundary" disabled={readOnly} onClick={()=>control.update([room.id],{boundaryLocked:false,lockedAt:null})}>Unlock boundary</button>
          : <button data-testid="lock-room-boundary" disabled={readOnly||!canApprove} title={canApprove?'Approve this boundary and keep it through re-scans':'Resolve the review items first'}
              onClick={()=>{setEditing(null);control.update([room.id],{confirmed:true,boundaryClosed:true,boundaryLocked:true,lockedAt:new Date().toISOString()});}}
              style={{background:canApprove&&!readOnly?'#15803d':undefined,color:canApprove&&!readOnly?'#fff':undefined}}>Confirm &amp; Lock Room Boundary</button>}
        <button disabled={readOnly||locked} onClick={()=>{setEditing(null);control.update([room.id],{excluded:true,confirmed:false,approvalInputs:null,selected:false,actions:[]});}}>Reject boundary</button>
        <button disabled={readOnly} onClick={()=>control.update([room.id],{actions:[],wetArea:false})}>Clear actions</button>
        <small style={{display:'block'}}>{(room.actions||[]).join(', ')}</small>
        {!(room.wallHeightM>0)&&(room.actions||[]).some(action=>['Wall Tiling','Painting'].includes(action))&&<small style={{color:'#a16207'}}>Set a wall finish height to calculate wall quantities.</small>}
      </div>}
    </div>;})}
    {outdoorAreas.length>0&&<div data-testid="outdoor-areas" style={{borderTop:'2px solid #0f766e',marginTop:10,paddingTop:8}}>
      <strong>Outdoor areas</strong> <small style={{color:'#475569'}}>(not living area)</small>
      {outdoorAreas.map(area=><div key={area.id} style={{display:'flex',justifyContent:'space-between',gap:6,marginTop:4}}>
        <button type="button" data-testid="outdoor-area-focus" onClick={()=>onFocusArea&&onFocusArea(area)} style={{all:'unset',cursor:'pointer',fontWeight:600,color:'#0f766e'}}>{area.label||area.type} (sheet {area.page})</button>
        <strong>{Number.isFinite(area.areaM2)?area.areaM2.toFixed(2):'-'} m²</strong>
      </div>)}
    </div>}
    {editing&&<p>Drag corners - they snap to wall corners, faces and centrelines. Double-click an edge to add a corner; right-click a corner to remove it. A room without a boundary can be redrawn by clicking its corners on the plan, then double-clicking to finish.</p>}
  </aside>;
}

export function RoomBoundaryLayer({ rooms, enabled, editing, control, scale, width, height, suppressClick, hoveredId = null, setHoveredId = () => {}, walls = [], pixelsPerMm = 1, visible = true, rotation = 0, focusedId = null, onFocus = null }) {
  const [hoveredLocal,setHoveredLocal]=useState(null);
  const [draft,setDraft]=useState([]);
  // Corner being dragged: the outline and its area follow the (snapped) pointer before it is saved.
  const [dragPreview,setDragPreview]=useState(null);
  const targets=useMemo(()=>editing?roomSnapTargets(walls,pixelsPerMm):{points:[],segments:[]},[editing,walls,pixelsPerMm]);
  const redraw=rooms.find(r=>r.id===editing&&!r.polygon?.length);
  const stop=e=>{e.cancelBubble=true;};
  const local=e=>e.target.getParent().getRelativePointerPosition();
  const hovered=hoveredLocal||hoveredId;
  if(!visible)return null;
  const snap=p=>snapRoomVertex(p,targets,SNAP_TOLERANCE_SCREEN_PX/scale);
  // A dragged corner never leaves the building: past an external wall's inside face it is pulled back onto it.
  const snapInside=(p,polygon)=>{const s=snap(p);const k=keepRoomCornerInside(s,polygon,targets);return k.clipped?{x:k.x,y:k.y,snapped:'external-face'}:s;};
  return <Group listening={enabled} name="room-boundaries">
    {rooms.filter(r=>!r.excluded&&r.polygon?.length>=3).map(room=>{
      const polygon=dragPreview?.roomId===room.id?dragPreview.polygon:room.polygon;
      const look=roomStatusAppearance(room,hovered===room.id);
      const live=dragPreview?.roomId===room.id?polygonAreaPerimeter(polygon,room.pixelsPerMm||pixelsPerMm):null;
      const editable=editing===room.id&&!room.boundaryLocked;
      return <Group key={room.id}>
      <Line name={`room-boundary:${room.id}`} points={polygon.flatMap(p=>[p.x,p.y])} closed
        fill={look.fill} stroke={look.stroke} strokeWidth={(room.selected||room.boundaryLocked?3:1.5)/scale} dash={look.dash.map(v=>v/scale)}
        onMouseEnter={()=>{setHoveredLocal(room.id);setHoveredId(room.id);}} onMouseLeave={()=>{setHoveredLocal(null);setHoveredId(null);}}
        onClick={e=>{stop(e);if(suppressClick.current){suppressClick.current=false;return;}if(onFocus)onFocus(room,{centre:false});else control.update([room.id],{selected:!room.selected});}}
        onDblClick={e=>{stop(e);if(!editable)return;const p=snap(local(e));let best=0,distance=Infinity;room.polygon.forEach((a,i)=>{const b=room.polygon[(i+1)%room.polygon.length];const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2)));const d=Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y));if(d<distance){distance=d;best=i;}});const next=[...room.polygon];next.splice(best+1,0,{x:p.x,y:p.y});control.update([room.id],{polygon:next,confirmed:false});}} />
      {focusedId===room.id&&<Line points={polygon.flatMap(p=>[p.x,p.y])} closed stroke="#2563eb" strokeWidth={5/scale} listening={false}/>}
      {(()=>{const at=roomLabelPoint(polygon);if(!at)return null;const area=(live?.areaM2??room.areaM2);
        // The label fits inside its room on screen: smaller in a small room, the area line dropped when there is
        // no room for it, and no label at all when the room is a few pixels across (it is named in the list).
        const across=2*at.d*scale, title=`${room.name}${room.boundaryLocked?' (locked)':room.confirmed?' (approved)':''}`;
        const font=Math.min(14,across*0.9/Math.max(4,title.length*0.62),across/2.6);
        if(font<6&&focusedId!==room.id)return null;
        const size=Math.max(font,focusedId===room.id?11:6);
        // Named in the middle of the room, upright on a rotated plan, on a backing so it reads over the drawing.
        return <Label x={at.x} y={at.y} rotation={-(Number(rotation)||0)} listening={false}>
          <Tag fill={focusedId===room.id?'#dbeafe':'rgba(255,255,255,0.92)'} stroke={look.stroke} strokeWidth={1/scale} cornerRadius={3/scale}/>
          <Text text={`${title}${size>=8||focusedId===room.id?`\n${Number.isFinite(area)?area.toFixed(2):'-'} m²`:''}`} fontSize={size/scale} lineHeight={1.15} padding={Math.min(3,size/4)/scale} fill="#0f172a" fontStyle="bold" align="center"/>
        </Label>;})()}
      {editable&&polygon.map((p,i)=><Circle key={i} name="room-vertex" x={p.x} y={p.y} radius={6/scale} fill="#fff" stroke="#2563eb" strokeWidth={2/scale} draggable
        onMouseDown={stop} onClick={stop} onDragStart={stop}
        onDragMove={e=>{stop(e);const s=snapInside({x:e.target.x(),y:e.target.y()},room.polygon);e.target.position({x:s.x,y:s.y});e.target.stroke(s.snapped?'#16a34a':'#2563eb');setDragPreview({roomId:room.id,polygon:room.polygon.map((q,j)=>j===i?{x:s.x,y:s.y}:q)});}}
        onDragEnd={e=>{stop(e);const s=snapInside({x:e.target.x(),y:e.target.y()},room.polygon);setDragPreview(null);control.update([room.id],{polygon:room.polygon.map((q,j)=>j===i?{x:s.x,y:s.y}:q),confirmed:false});}}
        onContextMenu={e=>{e.evt.preventDefault();stop(e);if(room.polygon.length>3)control.update([room.id],{polygon:room.polygon.filter((_,j)=>i!==j),confirmed:false});}} />)}
    </Group>;})}
    {redraw&&<><Rect width={width} height={height} fill="rgba(0,0,0,0.01)" onClick={e=>{stop(e);const p=snap(local(e));setDraft(previous=>previous.length&&Math.hypot(previous.at(-1).x-p.x,previous.at(-1).y-p.y)<1?previous:[...previous,{x:p.x,y:p.y}]);}} onDblClick={e=>{stop(e);if(draft.length>=3){control.update([redraw.id],{polygon:draft,confirmed:false,boundaryClosed:false});setDraft([]);}}}/><Line points={draft.flatMap(p=>[p.x,p.y])} stroke="#2563eb" strokeWidth={2/scale} listening={false}/></>}
  </Group>;
}
