import assert from 'node:assert/strict';
import {detectVectorWalls} from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
const ppm=.05,segments=[];
function line(a,b){segments.push({x1:(a[0]+1000)*ppm,y1:(a[1]+1000)*ppm,x2:(b[0]+1000)*ppm,y2:(b[1]+1000)*ppm,path:segments.length,subpath:segments.length,widthPx:.24,paint:'stroke',color:'#000000',dashed:false});}
function wall(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),n=[-dy/length*50,dx/length*50];for(const sign of [-1,1])line([a[0]+sign*n[0],a[1]+sign*n[1]],[b[0]+sign*n[0],b[1]+sign*n[1]]);}
wall([0,0],[10000,0]);wall([10000,0],[10000,6000]);wall([10000,6000],[0,6000]);wall([0,6000],[0,0]);wall([0,3000],[2000,3000]);wall([7000,3000],[10000,3000]);
line([2700,3000],[4400,3000]);line([4600,3010],[6300,3010]);
const found=detectVectorWalls(segments,{pixelsPerMm:ppm,logicalWidth:1000,logicalHeight:700});
const opening=found.openings.find(o=>o.kind==='sliding-door'&&Math.abs(o.x-(4500+1000)*ppm)<100*ppm&&Math.abs(o.y-4000*ppm)<100*ppm);
assert.ok(opening,'partial glass panels identify the measured wide opening');
assert.ok(Math.abs(opening.widthMm-5000)<100,`use both measured jambs, not only the 3600 mm central panel span (${opening.widthMm})`);
console.log('Panel width: partial slider panels retain the full measured jamb-to-jamb width.');
// Two disjoint strokes on the SAME wall face are wall remnants, not glazing.
const sameFace=segments.map((s,i)=>i===segments.length-1?{...s,y1:s.y1-10*ppm,y2:s.y2-10*ppm}:s);
const remnants=detectVectorWalls(sameFace,{pixelsPerMm:ppm,logicalWidth:1000,logicalHeight:700});
assert.ok(!remnants.openings.some(o=>o.kind==='sliding-door'&&Math.abs(o.x-(4500+1000)*ppm)<100*ppm&&Math.abs(o.y-4000*ppm)<100*ppm),'collinear remnants must not manufacture a wide slider');
console.log('Collinear remnants: separated strokes on one wall face cannot become an extra slider.');
