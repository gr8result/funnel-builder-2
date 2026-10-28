import { refineRoomEdges } from './roomBoundaryVision.js';
// Room coordinates are logical plan pixels, independent of viewport and render resolution.
export const ROOM_ACTIONS = ['Mark as Wet Area', 'Floor Tiling', 'Wall Tiling', 'Flooring', 'Painting', 'Include in Takeoff'];
export function roomType(name='') {
  return Object.entries({Bedroom:/\b(?:bed(?:room)?\s*\d*|master)\b/i,Kitchen:/\bkitchen\b/i,Bathroom:/\bbath(?:room)?\b/i,Ensuite:/\bens(?:uite)?\b/i,Laundry:/\b(?:laundry|ldry)\b/i,Garage:/\bgarage\b/i,Alfresco:/\balfresco\b/i,Patio:/\bpatio\b/i}).find(([,pattern])=>pattern.test(name))?.[0] || 'Other';
}
const cross = (a, b, c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function roomContains(polygon, p) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if(Math.abs(cross(a,b,p))<1e-8 && p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y)) return false;
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
export function measureRoom(room, pixelsPerMm) {
  const polygon = room.polygon || [];
  const issues = [];
  let area=0, perimeter=0;
  if (polygon.length<3 || polygon.length>100 || polygon.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) issues.push('Boundary is missing or invalid');
  else for(let i=0;i<polygon.length;i++) {
    const a=polygon[i], b=polygon[(i+1)%polygon.length];
    area+=a.x*b.y-b.x*a.y; perimeter+=Math.hypot(b.x-a.x,b.y-a.y);
    if(Math.hypot(b.x-a.x,b.y-a.y)<0.001) issues.push('Duplicate boundary vertex');
    for(let j=i+2;j<polygon.length;j++) {
      if(i===0&&j===polygon.length-1) continue;
      const c=polygon[j],d=polygon[(j+1)%polygon.length];
      if(cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0 && Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) && Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))) issues.push('Boundary crosses itself');
    }
  }
  if(Math.abs(area)<0.001) issues.push('Boundary has no area');
  if (polygon.some(p=>p.x<0||p.y<0||(room.pageWidth>0&&p.x>room.pageWidth)||(room.pageHeight>0&&p.y>room.pageHeight))) issues.push('Boundary extends outside the sheet');
  const valid = issues.length===0;
  const scale=Number(pixelsPerMm)*1000;
  if(!(scale>0)) issues.push('Calibrate this sheet');
  if(!room.level || room.level==='Unassigned') issues.push('Confirm the room level');
  const areaM2=valid&&scale>0 ? Math.abs(area)/2/scale**2 : null;
  const perimeterM=valid&&scale>0 ? perimeter/scale : null;
  if(room.printedAreaM2>0&&areaM2!==null&&Math.abs(areaM2-room.printedAreaM2)/room.printedAreaM2>0.08) issues.push('Boundary differs from printed area by more than 8%');
  for (const dimension of room.dimensionReferences || []) {
    if (!(pixelsPerMm>0) || dimension.basis!=='OBSERVED' || dimension.confidence<0.85 || !(dimension.valueMm>0)) continue;
    const measuredMm=Math.hypot(dimension.p2.x-dimension.p1.x,dimension.p2.y-dimension.p1.y)/pixelsPerMm;
    if(Math.abs(measuredMm-dimension.valueMm)/dimension.valueMm>0.08) issues.push('Calibration conflicts with a printed room dimension');
  }
  if (!room.confirmed && room.geometryReview) issues.push(room.geometryReview);
  if (room.overlapIds?.length) issues.push('Boundary overlaps another room on this sheet');
  if(!room.confirmed && (!(room.confidence>=0.85) || !room.boundaryClosed)) issues.push('Confirm the detected boundary');
  return {...room,areaM2,perimeterM,pixelsPerMm:Number(pixelsPerMm)||null,reviewRequired:issues.length>0,reviewReasons:[...new Set(issues)]};
}
export function validateRoomSet(rooms=[]) {
  const overlaps=new Map();
  const probes=polygon=>polygon.flatMap((p,i)=>[p,{x:(p.x+polygon[(i+1)%polygon.length].x)/2,y:(p.y+polygon[(i+1)%polygon.length].y)/2}]);
  const candidates=rooms.filter(r=>r.polygon?.length>=3).map(room=>({room,probes:probes(room.polygon),minX:Math.min(...room.polygon.map(p=>p.x)),maxX:Math.max(...room.polygon.map(p=>p.x)),minY:Math.min(...room.polygon.map(p=>p.y)),maxY:Math.max(...room.polygon.map(p=>p.y))}));
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++) {
    const first=candidates[i],second=candidates[j],a=first.room,b=second.room;
    if(a.page!==b.page||first.maxX<=second.minX||second.maxX<=first.minX||first.maxY<=second.minY||second.maxY<=first.minY)continue;
    const identical=a.polygon.length===b.polygon.length&&a.polygon.every(p=>b.polygon.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<0.001));
    const crossing=a.polygon.some((p,k)=>b.polygon.some((q,l)=>{
      const endA=a.polygon[(k+1)%a.polygon.length],endB=b.polygon[(l+1)%b.polygon.length];
      return cross(p,endA,q)*cross(p,endA,endB)<0&&cross(q,endB,p)*cross(q,endB,endA)<0;
    }));
    if(identical||crossing||first.probes.some(p=>roomContains(b.polygon,p))||second.probes.some(p=>roomContains(a.polygon,p))) {
      overlaps.set(a.id,[...(overlaps.get(a.id)||[]),b.id]);overlaps.set(b.id,[...(overlaps.get(b.id)||[]),a.id]);
    }
  }
  return rooms.map(room=>room.polygon?measureRoom({...room,overlapIds:overlaps.get(room.id)||[]},room.pixelsPerMm):room);
}
export function detectRoomBoundary(raw, {page,level,width,height,pixelsPerMm,walls=[],openings=[],raster=null}, index=0) {
  const nodes=(Array.isArray(raw.polygon)?raw.polygon:Array.isArray(raw.nodes)?raw.nodes:[]).map(p=>({x:p.x*width,y:p.y*height}));
  // Reuse nearby wall junctions, but never manufacture a bounding rectangle around a label.
  const junctions=walls.filter(w=>Number(w.page||1)===page).flatMap(w=>w.nodes||[]);
  const tolerance=Math.min(width,height)*0.002;
  const snapped=nodes.map(p=>{
    let nearest=p,distance=tolerance;
    for(const q of junctions){const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance){nearest=q;distance=d;}}
    return {x:nearest.x,y:nearest.y};
  });
  const refined=refineRoomEdges(snapped,raster,width,height);
  const openingIds=new Set();
  const supported=refined.edgeSupport.map((support,i)=>{
    const a=refined.polygon[i],b=refined.polygon[(i+1)%refined.polygon.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    if(!length)return 0;
    let threshold=0;
    for(const opening of openings.filter(o=>Number(o.page||1)===page)) {
      const t=((opening.x-a.x)*dx+(opening.y-a.y)*dy)/length**2;
      const distance=Math.abs(dx*(opening.y-a.y)-dy*(opening.x-a.x))/length;
      if(t>0&&t<1&&distance<Math.max(tolerance,Number(pixelsPerMm)*250)&&opening.widthMm>0) {
        threshold+=opening.widthMm*pixelsPerMm/length;openingIds.add(opening.id);
      }
    }
    return Math.min(1,support+threshold);
  });
  const geometryReview = supported.length && supported.some(value=>value<0.65) ? 'Some edges lack continuous wall evidence; check openings and open-plan transitions' : !raster ? 'Boundary needs a visual check against wall faces' : '';
  const dimensionReferences=(raw.dimensionReferences||[]).map(d=>({...d,p1:{x:d.p1.x*width,y:d.p1.y*height},p2:{x:d.p2.x*width,y:d.p2.y*height}}));
  return measureRoom({...raw,dimensionReferences,pageWidth:width,pageHeight:height,openingIds:[...openingIds],edgeSupport:refined.edgeSupport,geometryReview,id:raw.id||`room-${page}-${index}-${String(raw.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,page,level,levelId:level,name:raw.name,type:raw.type||roomType(raw.name),polygon:refined.polygon,source:'plan',detectionMethod:'ai-and-wall-edges',selected:false,actions:[],coordinateSpace:'logical-plan'},pixelsPerMm);
}
export function roomQuantityRows(rooms=[]) {
  return rooms.filter(room=>!room.reviewRequired&&room.areaM2>0).flatMap(room=>(room.actions||[])
    .filter(action=>ROOM_ACTIONS.includes(action)&&action!=='Mark as Wet Area')
    .map(action=>{
      const wallAction=['Wall Tiling','Painting'].includes(action);
      const needsHeight=wallAction&&!(room.wallHeightM>0);
      return {
        section:'Rooms',itemId:`${room.id}:${action}`,roomId:room.id,planSheet:room.page,floor:room.level,category:`${room.name} — ${action}`,
        quantity:needsHeight?null:Math.round((wallAction?room.perimeterM*room.wallHeightM:room.areaM2)*100)/100,
        unit:'m²',reviewRequired:needsHeight,
        notes:needsHeight?'Set wall finish height before using this quantity.':wallAction?'Gross wall area; opening deductions not included.':'Measured room floor area',
      };
    }));
}
