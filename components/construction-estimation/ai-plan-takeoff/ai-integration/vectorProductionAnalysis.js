import {vectorAnalysisFromLinework} from '../geometry/planModelAdapter.js';
import {wallPoints} from '../geometry/planModel.js';

const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
const validOpening = raw => raw.type === 'window' && raw.openingClass === 'Window' || raw.type === 'door' && ['Internal Door','External Door','Garage Door','Large Glazed/Stacker/Sliding Door','Other Opening'].includes(raw.openingClass);
const observed=item=>item?.basis==='OBSERVED'&&item.confidence>=.85&&typeof item.evidence==='string'&&item.evidence.trim().length>0;

// The provider supplies semantics. Its approximate coordinates are used only to
// associate those semantics with measured objects, never as replacement geometry.
export function vectorProductionAnalysis(response,detected,spec,{wallDecisions={},labels:extraLabels=[]}={}){
  const labels=[...extraLabels,...(response.rooms||[]).filter(r=>r.name&&validPoint(r)&&r.basis!=='ASSUMED'&&r.confidence>=.5)
    .map(r=>({name:r.name,x:r.x*spec.logicalWidth,y:r.y*spec.logicalHeight}))];
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
  return {vector,detected:measuredGeometry,response:{...response,...vector.response,openings,rooms:vector.rooms,
    review:[...(response.review||[]),...(unmatched.length?[`${unmatched.length} AI opening annotations lack an unambiguous measured opening; they were withheld from quantities.`]:[])]}};
}
