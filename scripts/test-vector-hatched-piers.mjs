import assert from 'node:assert/strict';
import { crossHatchedPiers, pairIsPierRim } from '../components/construction-estimation/ai-plan-takeoff/geometry/hatchedPiers.js';
import { vectorAnalysisFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
function hatch(width=600,height=500){
  const out=[];
  for(const sign of [-1,1])for(let intercept=-width;intercept<=height+width;intercept+=70){
    const points=[{x:0,y:intercept},{x:width,y:sign*width+intercept},{x:-intercept/sign,y:0},{x:(height-intercept)/sign,y:height}]
      .filter(p=>p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height);
    const unique=points.filter((p,i)=>points.findIndex(q=>q.x===p.x&&q.y===p.y)===i);
    if(unique.length===2)out.push({x1:unique[0].x,y1:unique[0].y,x2:unique[1].x,y2:unique[1].y,path:1,paint:'stroke',color:'#000000',widthPx:2});
  }
  return out;
}
const strokes=hatch(),piers=crossHatchedPiers(strokes,1);
assert.equal(piers.length,1);
assert.equal(crossHatchedPiers(strokes.filter(s=>(s.x2-s.x1)*(s.y2-s.y1)>0),1).length,0,'single-direction masonry hatch is not a pier');
assert.equal(crossHatchedPiers(hatch(1800,500),1).length,0,'long filled structural wall is not a compact pier');
assert.equal(crossHatchedPiers(strokes.map(s=>({...s,color:'#c7c8ca'})),1).length,0,'background hatch is not structural pier evidence');
const face=()=>({pieces:[{lo:0,hi:500}]});
const rim={angle:Math.PI/2,lo:0,hi:500,c0:0,c1:70,thicknessMm:70,faces:[face(),face()]};
assert.equal(pairIsPierRim(rim,piers,1),true);
assert.equal(pairIsPierRim({...rim,hi:2000},piers,1),false,'long real wall beyond the pier remains');
assert.equal(pairIsPierRim({...rim,faces:[{pieces:[{lo:-300,hi:500}]},face()]},piers,1),false,'a single continuing structural face protects the real wall beside a pier');
assert.equal(pairIsPierRim({...rim,c0:-300,c1:-230},piers,1),false,'an independent wall crossing the filled body is not a rim');
// Only the face on the pier's edge decides. A line merely passing alongside (a robe or shelf edge that
// runs on past the pier) does not turn the pier edge into a wall; a wall face that runs on past the
// pier along its edge does make it a wall.
const edgeFace=(pieces)=>({c:0,pieces}),otherFace=(pieces)=>({c:70,pieces});
assert.equal(pairIsPierRim({...rim,faces:[edgeFace([{lo:0,hi:500}]),otherFace([{lo:-300,hi:900}])]},piers,1),true,'pier edge paired with a line passing alongside is a rim, not a wall');
assert.equal(pairIsPierRim({...rim,faces:[edgeFace([{lo:-300,hi:500}]),otherFace([{lo:0,hi:500}])]},piers,1),false,'a wall face running on past the pier along its edge keeps the wall');
assert.equal(pairIsPierRim({...rim,faces:[edgeFace([{lo:0,hi:900}]),otherFace([{lo:-300,hi:900}])]},piers,1),false,'both faces running on: a real wall');
const spec={id:'test',page:1,name:'Ground Floor',pixelsPerMm:.1,logicalWidth:1000,logicalHeight:1000};
const corners=[{x:100,y:100},{x:500,y:100},{x:500,y:400},{x:100,y:400}];
const geometry={walls:corners.map((p,i)=>({id:`wall-${i}`,nodes:[p,corners[(i+1)%4]],measuredThicknessMm:100})),openings:[]};
const before=vectorAnalysisFromLinework(geometry,spec);
const reviewed={...geometry,walls:geometry.walls.map((w,i)=>i===0?{...w,quantityReview:'Drawn pier enclosure; review linear quantity'}:w)};
const after=vectorAnalysisFromLinework(reviewed,spec);
assert.equal(after.response.walls.length,before.response.walls.length-1,'classification withholds the rim quantity');
assert.deepEqual(after.rooms,before.rooms,'supported enclosure geometry remains available to room review');
assert.ok(after.reviewWallCandidates.some(w=>w.reason.includes('Drawn pier enclosure')));
const manual=vectorAnalysisFromLinework(reviewed,spec,{wallDecisions:{'linework:wall-0':'interior'}});
assert.equal(manual.response.walls.length,before.response.walls.length,'an explicit estimator correction is preserved');
console.log('PASS clipped cross-hatched piers, real-wall negative cases, enclosure preservation and explicit manual decisions.');
