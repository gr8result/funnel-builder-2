import assert from 'node:assert/strict';
import {detectVectorWalls} from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
function fixture({rotation=0,ppm=.05,dashedLeaf=false}={}){
 const segments=[];const c=Math.cos(rotation),s=Math.sin(rotation),point=([x,y])=>({x:(x*c-y*s+12000)*ppm,y:(x*s+y*c+12000)*ppm});
 const line=(a,b,extra={})=>{const p=point(a),q=point(b);segments.push({x1:p.x,y1:p.y,x2:q.x,y2:q.y,path:segments.length,subpath:segments.length,widthPx:.24,paint:'stroke',color:'#000000',dashed:false,...extra});};
 const wall=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),n=[-dy/len*50,dx/len*50];for(const sign of [-1,1])line([a[0]+n[0]*sign,a[1]+n[1]*sign],[b[0]+n[0]*sign,b[1]+n[1]*sign]);};
 wall([0,0],[8000,0]);wall([8000,0],[8000,8000]);wall([8000,8000],[0,8000]);wall([0,8000],[0,0]);
 // No horizontal host at the door. Its two measured perpendicular jamb walls
 // independently support a horizontal 820 mm opening.
 wall([2000,2000],[2000,8000]);wall([3000,2000],[3000,8000]);
 const hinge=[2000,2000],r=820;
 line(hinge,[2000,2820],{path:10000,subpath:10000,dashed:dashedLeaf});
 for(let i=0;i<6;i++){const a=Math.PI/2*i/6,b=Math.PI/2*(i+1)/6;line([hinge[0]+r*Math.cos(a),hinge[1]+r*Math.sin(a)],[hinge[0]+r*Math.cos(b),hinge[1]+r*Math.sin(b)],{path:10001,subpath:10001,curve:true});}
 return {segments,point,context:{pixelsPerMm:ppm,logicalWidth:2000,logicalHeight:2000}};
}
for(const rotation of [0,Math.PI/2,.63]){
 const {segments,point,context}=fixture({rotation});const found=detectVectorWalls(segments,context);const expected=point([2410,2000]);
 const doors=found.openings.filter(o=>o.kind==='door'&&Math.hypot(o.x-expected.x,o.y-expected.y)/context.pixelsPerMm<100);
 assert.equal(doors.length,1,'a leaf and both measured jambs locate one door');
 assert.ok(Math.abs(doors[0].widthMm-820)<30,'leaf radius measures the opening width');
 const wrong=point([2000,2410]);assert.ok(!found.openings.some(o=>o.kind==='door'&&Math.hypot(o.x-wrong.x,o.y-wrong.y)/context.pixelsPerMm<100),'the door must not be rotated onto a perpendicular wall');
}
const dashed=fixture({dashedLeaf:true});const expected=dashed.point([2410,2000]);
assert.ok(!detectVectorWalls(dashed.segments,dashed.context).openings.some(o=>o.kind==='door'&&Math.hypot(o.x-expected.x,o.y-expected.y)/dashed.context.pixelsPerMm<100),'a dashed leaf cannot authorize an unsupported doorway bridge');
console.log('Door jambs: drawn-leaf direction, two-jamb support, width, rotation and dashed-leaf exclusion passed.');
