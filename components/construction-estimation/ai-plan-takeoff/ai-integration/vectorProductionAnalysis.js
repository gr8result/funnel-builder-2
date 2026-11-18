import {vectorAnalysisFromLinework} from '../geometry/planModelAdapter.js';
import {wallPoints} from '../geometry/planModel.js';
import {buildingOutlines} from '../geometry/buildingOutline.js';
import {OUTDOOR_LABEL,againstBuilding,pointInPolygon,traceOutdoorArea} from '../geometry/outdoorAreas.js';

const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
const validOpening = raw => raw.type === 'window' && raw.openingClass === 'Window' || raw.type === 'door' && ['Internal Door','External Door','Garage Door','Large Glazed/Stacker/Sliding Door','Other Opening'].includes(raw.openingClass);
const observed=item=>item?.basis==='OBSERVED'&&item.confidence>=.85&&typeof item.evidence==='string'&&item.evidence.trim().length>0;

// The provider supplies semantics. Its approximate coordinates are used only to
// associate those semantics with measured objects, never as replacement geometry.
export function vectorProductionAnalysis(response,detected,spec,{wallDecisions={},labels:extraLabels=[],outdoor=null}={}){
  // Room names printed in the PDF's own text layer sit exactly where the drawing puts them; provider label
  // positions are typically 1-2 m out. When the sheet carries text labels they name the rooms, and provider
  // labels are used only for sheets without them (scans, outlined text), so one room never gets two names.
  const providerLabels=(response.rooms||[]).filter(r=>r.name&&validPoint(r)&&r.basis!=='ASSUMED'&&r.confidence>=.5)
    .map(r=>({name:r.name,x:r.x*spec.logicalWidth,y:r.y*spec.logicalHeight}));
  const labels=extraLabels.length?[...extraLabels]:providerLabels;
  // A documented annotation may confirm an existing measured gap. It cannot
  // create a new span or move its measured ends; ambiguous matches stay open.
  const annotations=(response.openings||[]).filter(raw=>observed(raw)&&raw.confidence>=.9&&validOpening(raw)&&validPoint(raw)
    &&raw.dimensionBasis==='OBSERVED'&&typeof raw.dimensionEvidence==='string'&&raw.dimensionEvidence.trim()&&Number.isFinite(raw.explicitWidthMm)&&raw.explicitWidthMm>0);
  const eligible=(detected.openings||[]).filter(gap=>gap.confirmed===false&&!gap.bridgeOnly&&gap.hostWallIds?.length>=2&&gap.widthMm>0);
  const matches=annotations.map(raw=>({raw,gaps:eligible.filter(gap=>Math.hypot(raw.x*spec.logicalWidth-gap.x,raw.y*spec.logicalHeight-gap.y)/spec.pixelsPerMm<=200
    &&raw.explicitWidthMm/gap.widthMm>=.75&&raw.explicitWidthMm/gap.widthMm<=1.25)}));
  const confirmations=new Map();
  for(const match of matches)if(match.gaps.length===1&&matches.filter(other=>other.gaps.includes(match.gaps[0])).length===1)confirmations.set(match.gaps[0],match.raw);
  // A wide gap with one line across it is a garage door only where the sheet names a garage (or carport)
  // within reach. Elsewhere the same figure may be a balustrade, a void edge or an open side (upper floors,
  // decks): the measured gap keeps closing the wall line (so the outline and rooms still close), but its type
  // waits for the builder and it is not counted as a garage door.
  const garageWords=[...labels.map(label=>({text:label.name,x:label.x,y:label.y})),...((outdoor?.textItems)||[]).map(item=>({text:item.text,x:item.x+(Number(item.width)||0)/2,y:item.y}))]
    .filter(item=>/garage|carport/i.test(String(item.text||''))&&validPoint(item));
  const garageNamed=gap=>garageWords.some(item=>Math.hypot(item.x-gap.x,item.y-gap.y)/spec.pixelsPerMm<=9000);
  const measuredGeometry={...detected,openings:(detected.openings||[]).map(gap=>{
    const raw=confirmations.get(gap);
    if(!raw&&gap.kind==='garage-door'&&!garageNamed(gap))return {...gap,needsClassification:true,garageUnconfirmed:true,
      evidence:`${gap.evidence}; no garage is named near it, so it may be a balustrade, void edge or open side: confirm what it is`};
    if(!raw)return gap;
    const kind=raw.openingClass==='Other Opening'?'opening':raw.type==='window'?'window':/barn/i.test(raw.subType||'')?'barn-door':'door';
    return {...gap,confirmed:true,kind,evidence:`Measured gap confirmed by documented opening annotation: ${raw.evidence}`};
  })};
  const drawnLines=(outdoor?.segments)||[];
  const initial=vectorAnalysisFromLinework(measuredGeometry,spec,{labels,wallDecisions,drawnLines});
  const classifications={};
  for(const wall of Object.values(initial.level.walls)){
    const points=wallPoints(initial.level,wall).map(p=>({x:p.x*spec.pixelsPerMm,y:p.y*spec.pixelsPerMm}));
    const matches=(response.walls||[]).filter(raw=>observed(raw)&&['interior','exterior'].includes(raw.category)&&raw.nodes?.length>=2&&raw.nodes.every(validPoint)).filter(raw=>{
      const nodes=raw.nodes.map(p=>({x:p.x*spec.logicalWidth,y:p.y*spec.logicalHeight}));let hit=0,total=0;
      for(let i=1;i<points.length;i++)for(let j=0;j<5;j++){
        const p={x:points[i-1].x+(points[i].x-points[i-1].x)*(j+.5)/5,y:points[i-1].y+(points[i].y-points[i-1].y)*(j+.5)/5};total++;
        const angle=Math.atan2(points[i].y-points[i-1].y,points[i].x-points[i-1].x);
        if(nodes.slice(1).some((b,k)=>{const d=Math.abs(Math.atan2(b.y-nodes[k].y,b.x-nodes[k].x)-angle)%Math.PI;return Math.min(d,Math.PI-d)<.17&&distance(p,nodes[k],b)<=200*spec.pixelsPerMm;}))hit++;
      }
      return total>0&&hit/total>=.8;
    });
    if(matches.length&&new Set(matches.map(m=>m.category)).size===1)classifications[wall.detectionKey]={category:matches[0].category,evidence:matches[0].evidence};
  }
  const vector=Object.keys(classifications).length ? vectorAnalysisFromLinework(measuredGeometry,spec,{labels,classifications,wallDecisions,drawnLines}) : initial;
  const used=new Set();
  const openings=vector.response.openings.map(measured=>{
    const near=(response.openings||[]).filter(raw=>observed(raw)&&validPoint(raw)&&!used.has(raw)).map(raw=>({raw,d:Math.hypot((raw.x-measured.x)*spec.logicalWidth,(raw.y-measured.y)*spec.logicalHeight)/spec.pixelsPerMm})).filter(x=>x.d<=400).sort((a,b)=>a.d-b.d);
    if(!near.length||(near[1]&&near[1].d-near[0].d<50))return measured;
    const raw=near[0].raw;used.add(raw);
    const semantic={};
    if(validOpening(raw)){
      semantic.needsClassification=false;
      semantic.type=raw.type;semantic.openingClass=raw.openingClass;if(typeof raw.subType==='string')semantic.subType=raw.subType;
    }
    for(const key of ['tag','sizeCode','glassType','frameMaterial','dimensionEvidence'])if(typeof raw[key]==='string')semantic[key]=raw[key];
    // Explicit dimensions must have documentary evidence. An AI-estimated width
    // never displaces a calibrated measured width.
    if(raw.dimensionBasis==='OBSERVED'&&raw.dimensionEvidence){for(const key of ['explicitWidthMm','explicitHeightMm'])if(raw[key]>0)semantic[key]=raw[key];}
    return {...measured,...semantic};
  });
  const unmatched=(response.openings||[]).filter(raw=>observed(raw)&&!used.has(raw));
  vector.report.unmatchedOpeningAnnotations = unmatched.length;
  vector.report.openingsNeedingClassification = openings.filter(opening=>opening.needsClassification).length;
  vector.report.documentedGapConfirmations = confirmations.size;
  vector.response = {...vector.response,openings};
  // Words printed on the sheet: its text layer, room names read locally, and other words read locally.
  const sheetText=[...((outdoor?.textItems)||[]).map(item=>({text:String(item.text||item.str||''),x:item.x+(Number(item.width)||0)/2,y:item.y})),
    ...((outdoor?.notes)||[]).map(item=>({text:String(item.text||''),x:item.x,y:item.y})),...labels.map(label=>({text:label.name,x:label.x,y:label.y}))].filter(item=>item.text&&validPoint(item));
  excludeRoofOnlySpaces(vector,spec,sheetText);
  const buildingAreas=measuredBuildingAreas(response.buildingAreas||[],vector,spec,{...(outdoor||{}),sheetText});
  vector.report.footprint=buildingAreas.report;
  return {vector,detected:measuredGeometry,response:{...response,...vector.response,openings,rooms:vector.rooms,buildingAreas:buildingAreas.areas,
    review:[...(response.review||[]),...(unmatched.length?[`${unmatched.length} AI opening annotations lack an unambiguous measured opening; they were withheld from quantities.`]:[])]}};
}

const OUTDOOR=/\b(alfresco|patio|balcony|porch|verandah|veranda|deck|terrace|courtyard|portico)\b/i;
// Words that mark a drawn area as roof, not floor: the roof over the storey below drawn on an upper plan
// (a porch or entry roof inside the upper walls' lines), with its pitch, gutter or sheeting noted.
export const ROOF_WORDS=/\b(roof|roofing|pitch|pitched|gutter|awnings?|skillion|sheeting|colorbond|polycarbonate|metal\s*deck)\b|\d\s*°/i;
const unnamed=room=>!room.name||/^unlabelled room/i.test(room.name);

// An enclosed area with no room name and a roof word printed inside it is roof (over the storey below),
// not a room of this storey: it is left out of the room schedule and the floor outline, and walls that bound
// nothing but it wait for the builder (a parapet, a fascia or a low wall, not a house wall of this storey).
function excludeRoofOnlySpaces(vector,spec,sheetText){
  const marks=sheetText.filter(item=>ROOF_WORDS.test(item.text)).map(item=>({...item,nx:item.x/spec.logicalWidth,ny:item.y/spec.logicalHeight}));
  if(!marks.length)return;
  const inside=(room,mark)=>pointInPolygon({x:mark.nx,y:mark.ny},room.polygon);
  const roof=(vector.rooms||[]).filter(room=>unnamed(room)&&room.polygon?.length>=3&&marks.some(mark=>inside(room,mark)));
  if(!roof.length)return;
  const words=room=>[...new Set(marks.filter(mark=>inside(room,mark)).map(mark=>mark.text))];
  vector.roofOnlySpaces=roof.map(room=>({id:room.id,polygon:room.polygon,areaM2:room.measurementBases?.grossRoomAreaM2??null,words:words(room),
    evidence:`Enclosed area with no room name and "${words(room).join('", "')}" printed inside it: roof over the storey below, not floor of this storey. Left out of the rooms and the floor outline; confirm.`}));
  vector.rooms=vector.rooms.filter(room=>!roof.includes(room));
  if(vector.report)vector.report.roofOnlySpaces=roof.length;
  // Walls whose every side is roof or outside: held for review instead of counted as house walls.
  const mm=p=>({x:p.x*spec.logicalWidth/spec.pixelsPerMm,y:p.y*spec.logicalHeight/spec.pixelsPerMm});
  const roofRings=roof.map(room=>room.polygon.map(mm)),roomRings=vector.rooms.filter(room=>room.polygon?.length>=3).map(room=>room.polygon.map(mm));
  const near=(p,rings,reach)=>rings.some(r=>pointInPolygon(p,r)||r.some((a,i)=>distance(p,a,r[(i+1)%r.length])<=reach));
  const hosted=new Set((vector.response.openings||[]).map(opening=>opening.hostDetectionId).filter(Boolean));
  const held=[];
  const walls=(vector.response.walls||[]).filter(wall=>{
    if(hosted.has(wall.detectionId)||!(wall.nodes?.length>=2))return true;
    const pts=wall.nodes.map(mm),reach=(Number(wall.thicknessMm)||90)/2+60;let byRoof=0,total=0;
    for(let i=1;i<pts.length;i++)for(let k=0;k<8;k++){const t=(k+.5)/8,p={x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t,y:pts[i-1].y+(pts[i].y-pts[i-1].y)*t};total++;
      if(!near(p,roomRings,reach)&&near(p,roofRings,reach))byRoof++;}
    if(!(total&&byRoof/total>=.75))return true;
    held.push(wall);return false;
  });
  if(!held.length)return;
  const lineage=new Map((vector.wallLineage||[]).map(item=>[item.detectionId,item]));
  vector.response={...vector.response,walls};
  vector.reviewWallCandidates=[...(vector.reviewWallCandidates||[]),...held.map(wall=>{const item=lineage.get(wall.detectionId)||{};return {
    id:`review-wall-${item.modelWallId||wall.detectionId}`,modelWallId:item.modelWallId||null,detectionKey:item.detectionKey||null,absorbedKeys:item.absorbedKeys||[],page:spec.page,
    nodes:wall.nodes.map(p=>({x:p.x*spec.logicalWidth,y:p.y*spec.logicalHeight})),normalizedNodes:wall.nodes,thicknessMm:wall.thicknessMm,category:null,status:'review-required',
    reason:'Bounds only an area marked as roof (and outside): a parapet, fascia or low wall rather than a house wall of this storey. Confirm it as External to measure it, or mark it Not a wall.'};})];
  if(vector.report)vector.report.roofOnlyWallsHeld=held.length;
}
const OUTDOOR_TYPES=['Alfresco','Patio','Porch','Balcony','Deck'];
const ringArea=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p.x*q.y-q.x*p.y;},0))/2;

// Floor areas on a measured sheet come from the measured geometry. The building outline is the measured
// rooms with their walls out to the outer face (geometry/buildingOutline.js); the plan reading's footprint
// rectangle is kept only as readingNodes for review. Outdoor areas (balcony, terrace, alfresco) keep the
// reading's outline, but the side along the house is put on the building's outer face, so an outdoor area
// never overlaps the house or leaves a gap against it.
function measuredBuildingAreas(readings,vector,spec,outdoor=null){
  const toMm=p=>({x:p.x*spec.logicalWidth/spec.pixelsPerMm,y:p.y*spec.logicalHeight/spec.pixelsPerMm});
  const fromMm=p=>({x:p.x*spec.pixelsPerMm/spec.logicalWidth,y:p.y*spec.pixelsPerMm/spec.logicalHeight});
  const indoor=(vector.rooms||[]).filter(room=>room.polygon?.length>=3&&!OUTDOOR.test(room.name||''));
  const walls=(vector.response.walls||[]).map(wall=>({nodes:wall.nodes.map(toMm),thicknessMm:wall.thicknessMm}));
  // The connected wall model (mm), spans across openings included: the building's envelope even where a
  // space inside it does not close as a room.
  const envelope=vector.level?[...Object.values(vector.level.walls).map(wall=>({nodes:wallPoints(vector.level,wall),thicknessMm:wall.thicknessMm})),
    ...Object.values(vector.level.separators||{}).filter(item=>item.basis==='gap-closure'||item.basis==='opening-closure').map(item=>({nodes:item.nodeIds.map(id=>vector.level.nodes[id]).filter(Boolean),thicknessMm:90}))]:[];
  const roofRings=(vector.roofOnlySpaces||[]).map(space=>space.polygon.map(toMm));
  const outlines=indoor.length?buildingOutlines(indoor.map(room=>room.polygon.map(toMm)),walls,roofRings.length?{exclude:roofRings}:{},envelope):[];
  const report={measured:Boolean(outlines.length),outlineM2:outlines[0]?+outlines[0].areaM2.toFixed(2):null,rooms:indoor.length,...(roofRings.length?{roofOnlyExcluded:roofRings.length}:{})};
  if(!outlines.length)return {areas:readings,report};
  const outline=outlines[0];
  const evidence=`Outline of the ${indoor.length} measured rooms with their walls out to the outer face (${outline.areaM2.toFixed(2)} m²), measured from the vector linework on sheet ${spec.page}; door and window gaps closed.`;
  let placed=false;
  const areas=readings.map(area=>{
    if(area?.type==='Footprint'&&!placed){
      placed=true;
      report.readingM2=Array.isArray(area.nodes)&&area.nodes.length>=3?+(ringArea(area.nodes.map(toMm))/1e6).toFixed(2):null;
      return {...area,nodes:outline.polygon.map(fromMm),readingNodes:area.nodes,measuredFrom:'rooms-and-walls',basis:'OBSERVED',confidence:Math.max(Number(area.confidence)||0,0.8),
        evidence:`${evidence}${report.readingM2?` The plan reading's own outline was ${report.readingM2} m².`:''}`};
    }
    if(area?.type==='Footprint')return null; // one building outline per sheet
    if(OUTDOOR_TYPES.includes(area?.type)&&Array.isArray(area.nodes)&&area.nodes.length>=3){
      const moved=againstBuilding(area.nodes.map(toMm),outline.polygon);
      if(!moved.changed)return area;
      return {...area,nodes:moved.polygon.map(fromMm),readingNodes:area.nodes,evidence:`${area.evidence||''} Side along the house put on the building's outer face (measured).`.trim()};
    }
    return area;
  }).filter(Boolean);
  if(!placed){
    report.created=true;
    areas.unshift({detectionId:`vector-footprint-${spec.page}`,type:'Footprint',nodes:outline.polygon.map(fromMm),measuredFrom:'rooms-and-walls',basis:'OBSERVED',confidence:0.8,evidence});
  }
  // Outdoor areas named on the sheet, measured from their drawn outline (geometry/outdoorAreas.js). A plan
  // reading of the same area keeps only its label and position; the outline is the drawing's.
  // Labels from the text layer and from local reading of outlined text (a sheet with no text layer).
  const outdoorText=outdoor?.sheetText||((outdoor?.textItems)||[]).map(t=>({text:String(t.text||t.str||''),x:t.x+(Number(t.width)||0)/2,y:t.y}));
  if(outdoor?.segments?.length&&outdoorText.length){
    const segments=outdoor.segments.map(s=>({x1:s.x1/spec.pixelsPerMm,y1:s.y1/spec.pixelsPerMm,x2:s.x2/spec.pixelsPerMm,y2:s.y2/spec.pixelsPerMm}));
    const labels=outdoorText.filter(t=>OUTDOOR_LABEL.test(String(t.text||''))&&Number.isFinite(t.x)&&Number.isFinite(t.y))
      .map(t=>({text:String(t.text).trim(),x:t.x/spec.pixelsPerMm,y:t.y/spec.pixelsPerMm}));
    report.outdoor=[];const traced=[];
    for(const label of labels){
      const found=traceOutdoorArea({segments,label,building:outline.polygon,exclude:roofRings});
      if(found.failed){report.outdoor.push({label:label.text,failed:found.failed});continue;}
      const centre={x:found.polygon.reduce((s,p)=>s+p.x,0)/found.polygon.length,y:found.polygon.reduce((s,p)=>s+p.y,0)/found.polygon.length};
      if(traced.some(t=>pointInPolygon(centre,t.polygon)))continue; // a second label in the same area
      traced.push(found);report.outdoor.push({label:label.text,type:found.type,areaM2:+found.areaM2.toFixed(2),widthMm:found.widthMm,depthMm:found.depthMm});
      const reading=areas.findIndex(a=>OUTDOOR_TYPES.includes(a?.type)&&a.measuredFrom!=='drawn-outline'&&Array.isArray(a.nodes)&&a.nodes.length>=3&&pointInPolygon(a.nodes.map(toMm).reduce((s,p,_,all)=>({x:s.x+p.x/all.length,y:s.y+p.y/all.length}),{x:0,y:0}),found.polygon));
      const area={type:found.type,label:found.label,nodes:found.polygon.map(fromMm),measuredFrom:'drawn-outline',basis:'OBSERVED',confidence:0.8,evidence:found.evidence};
      if(reading>=0)areas[reading]={...areas[reading],...area,readingNodes:areas[reading].nodes};
      else areas.push({detectionId:`vector-outdoor-${spec.page}-${traced.length}`,...area});
    }
  }
  return {areas,report};
}
