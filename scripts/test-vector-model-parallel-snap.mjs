import assert from 'node:assert/strict';
import { createLevel, mergeDetections, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
const thin={a:{x:0,y:0},b:{x:0,y:600},thicknessMm:70,detectionKey:'thin'};
const thick=x=>({a:{x,y:500},b:{x,y:1500},thicknessMm:313,detectionKey:'thick'});
for(const reverse of [false,true]) {
  const walls=[thin,thick(200)];if(reverse)walls.reverse();
  const {level}=mergeDetections(createLevel({id:'parallel'}),{walls},{measuredLinework:true});
  const wall=Object.values(level.walls).find(w=>w.detectionKey==='thin');
  assert.ok(wallPoints(level,wall).every(p=>Math.abs(p.x)<.001),'measured end cannot be pulled 200mm sideways onto a thick parallel line');
}
const near=mergeDetections(createLevel({id:'near'}),{walls:[thick(40),thin]},{measuredLinework:true}).level;
assert.deepEqual(near,mergeDetections(createLevel({id:'near'}),{walls:[thick(40),thin]}).level,'ordinary sub-snap joins retain existing behavior');
const tee=mergeDetections(createLevel({id:'tee'}),{walls:[{a:{x:-1000,y:650},b:{x:1000,y:650},thicknessMm:100,detectionKey:'cross'},thin]},{measuredLinework:true}).level;
const stem=Object.values(tee.walls).find(w=>w.detectionKey==='thin');
assert.ok(wallPoints(tee,stem).some(p=>p.x===0&&p.y===650),'real T junction reaches measured perpendicular host');
console.log('Measured model joins: parallel side pulls blocked beyond existing snap tolerance; short offsets and real perpendicular junctions retained.');
