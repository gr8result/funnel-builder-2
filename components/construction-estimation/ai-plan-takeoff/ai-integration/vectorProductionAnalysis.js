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
  const measuredGeometry={...detected,openings:(detected.openings||[]).map(gap=>{
    const raw=confirmations.get(gap);if(!raw)return gap;
    const kind=raw.openingClass==='Other Opening'?'opening':raw.type==='window'?'window':/barn/i.test(raw.subType||'')?'barn-door':'door';
    return {...gap,confirmed:true,kind,evidence:`Measured gap confirmed by documented opening annotation: ${raw.evidence}`};
  })};
  const initial=vectorAnalysisFromLinework(measuredGeometry,spec,{labels,wallDecisions});
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
  const vector=Object.keys(classifications).length ? vectorAnalysisFromLinework(measuredGeometry,spec,{labels,classifications,wallDecisions}) : initial;
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
  const buildingAreas=measuredBuildingAreas(response.buildingAreas||[],vector,spec,outdoor);
  vector.report.footprint=buildingAreas.report;
  return {vector,detected:measuredGeometry,response:{...response,...vector.response,openings,rooms:vector.rooms,buildingAreas:buildingAreas.areas,
    review:[...(response.review||[]),...(unmatched.length?[`${unmatched.length} AI opening annotations lack an unambiguous measured opening; they were withheld from quantities.`]:[])]}};
}

const OUTDOOR=/\b(alfresco|patio|balcony|porch|verandah|veranda|deck|terrace|courtyard|portico)\b/i;
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
  const outlines=indoor.length?buildingOutlines(indoor.map(room=>room.polygon.map(toMm)),walls):[];
  const report={measured:Boolean(outlines.length),outlineM2:outlines[0]?+outlines[0].areaM2.toFixed(2):null,rooms:indoor.length};
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
  if(outdoor?.segments?.length&&outdoor?.textItems?.length){
    const segments=outdoor.segments.map(s=>({x1:s.x1/spec.pixelsPerMm,y1:s.y1/spec.pixelsPerMm,x2:s.x2/spec.pixelsPerMm,y2:s.y2/spec.pixelsPerMm}));
    const labels=outdoor.textItems.filter(t=>OUTDOOR_LABEL.test(String(t.text||t.str||''))&&Number.isFinite(t.x)&&Number.isFinite(t.y))
      .map(t=>({text:String(t.text||t.str).trim(),x:(t.x+(Number(t.width)||0)/2)/spec.pixelsPerMm,y:t.y/spec.pixelsPerMm}));
    report.outdoor=[];const traced=[];
    for(const label of labels){
      const found=traceOutdoorArea({segments,label,building:outline.polygon});
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
