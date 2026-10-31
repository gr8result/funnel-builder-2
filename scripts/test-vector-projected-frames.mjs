import assert from 'node:assert/strict';
import {detectVectorWalls} from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
function fixture({angle=0,ppm=.05,capCount=2,dashedCaps=false,depth=140}={}){
 const segments=[],c=Math.cos(angle),s=Math.sin(angle);
 const at=([x,y])=>({x:(x*c-y*s+10000)*ppm,y:(x*s+y*c+10000)*ppm});
 const line=(a,b,extra={})=>{const p=at(a),q=at(b);segments.push({x1:p.x,y1:p.y,x2:q.x,y2:q.y,path:segments.length,subpath:segments.length,widthPx:.24,paint:'stroke',color:'#000000',dashed:false,...extra});};
 const wall=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),n=[-dy/l*50,dx/l*50];for(const k of [-1,1])line([a[0]+k*n[0],a[1]+k*n[1]],[b[0]+k*n[0],b[1]+k*n[1]]);};
 wall([0,0],[6000,0]);wall([6000,0],[6000,6000]);wall([6000,6000],[0,6000]);wall([0,6000],[0,0]);
 line([1500,-120],[3300,-120]);line([1500,-120-depth],[3300,-120-depth]);
 if(capCount>=1)line([1500,50],[1500,-120-depth],{dashed:dashedCaps});
 if(capCount>=2)line([3300,50],[3300,-120-depth],{dashed:dashedCaps});
 return {segments,at,context:{pixelsPerMm:ppm,logicalWidth:22000*ppm,logicalHeight:22000*ppm}};
}
for(const angle of [0,Math.PI/2,Math.PI/4])for(const ppm of [.03,.1]){
 const f=fixture({angle,ppm}),expected=f.at([2400,0]),found=detectVectorWalls(f.segments,f.context);
 const openings=found.openings.filter(o=>Math.hypot(o.x-expected.x,o.y-expected.y)<100*ppm);
 assert.equal(openings.length,1,'one projected frame on the measured host');assert.ok(Math.abs(openings[0].widthMm-1800)<30);
 assert.ok(openings[0].hostWallIds.length===1);assert.equal(openings[0].needsClassification,true,'frame geometry alone cannot establish a window/door quantity');
}
for(const options of [{capCount:1},{capCount:0},{dashedCaps:true},{depth:600}]){
 const f=fixture(options),expected=f.at([2400,0]);assert.ok(!detectVectorWalls(f.segments,f.context).openings.some(o=>Math.hypot(o.x-expected.x,o.y-expected.y)<100*f.context.pixelsPerMm),JSON.stringify(options));
}
console.log('Projected frames: two-cap evidence, host, measured width, rotation/scale and missing/dashed cap/deep joinery negatives passed.');
