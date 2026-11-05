import assert from 'node:assert/strict';
import { plan } from './test-vector-window-boxes.mjs';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
for(const scale of [.0283,.09])for(const angle of [0,Math.PI/2]){
  const {segments,P,context}=plan(scale,angle);
  const add=(a,b,tag)=>{const p=P(a),q=P(b);const s={x1:p.x,y1:p.y,x2:q.x,y2:q.y,path:5000+segments.length,subpath:0,paint:'stroke',widthPx:.24,color:'#000000',tag};segments.push(s);return s;};
  add([4000,35],[4000,3085],'back');
  add([4140,35],[4140,1790],'front');add([4140,1858],[4140,3085],'front');
  add([4110,648],[4110,2450],'inset');
  add([4140,1790],[9965,1790],'junction');add([4140,1858],[9965,1858],'junction');
  add([4000,3085],[4140,3085],'cap');
  const label={text:'600 x 1800 niche',...P([3950,1200])};
  const read=(parts,labels=[label])=>detectVectorWalls(parts,{...context,textItems:labels});
  const found=read(segments);
  assert.equal(found.stats.annotatedNiches,1,'complete dimensioned niche outline is established');
  assert.ok(found.walls.filter(w=>Math.abs(w.measuredThicknessMm-140)<1).length>=2,'both measured faces continue through the evidenced T junction');
  assert.ok(found.walls.some(w=>w.lengthMm>5000&&Math.abs(w.measuredThicknessMm-70)<1),'real surrounding walls remain');
  for(const tag of ['cap','junction','front'])assert.ok(read(segments.filter(s=>s.tag!==tag)).stats.annotatedNiches===0,`missing ${tag} cannot promote an outline`);
  assert.ok(read(segments,[]).stats.annotatedNiches===0,'without explicit niche annotation, an inset-looking real wall is retained');
  assert.ok(read(segments,[{...label,text:'600 x 1200 niche'}]).stats.annotatedNiches===0,'wrong dimension cannot disambiguate a wall');
}
console.log('Annotated niche: measured outer faces, exact T interruption, end cap, wall anchor and matching dimension required; real-wall negatives passed.');
