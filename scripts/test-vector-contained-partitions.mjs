import assert from 'node:assert/strict';
import {addWall,createLevel,wallCategories,computeRooms,updateWall} from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
const outline=[[0,0],[8000,0],[8000,8000],[0,8000]];
function build(points=outline, rotation=0){const c=Math.cos(rotation),s=Math.sin(rotation),at=([x,y])=>({x:x*c-y*s,y:x*s+y*c});let level=createLevel({id:'test'});for(let i=0;i<points.length;i++)level=addWall(level,{a:at(points[i]),b:at(points[(i+1)%points.length]),thicknessMm:200}).level;return {level,at};}
for(const angle of [0,.63,Math.PI/2]){
 let {level,at}=build(outline,angle);const result=addWall(level,{a:at([2000,2000]),b:at([6000,2000]),thicknessMm:90});level=result.level;
 const key=result.wallIds[0];const frozen=JSON.stringify(level);const rooms=computeRooms(level);
 assert.equal(wallCategories(level)[key],'interior','a measured free partition inside a closed face is internal');
 assert.equal(JSON.stringify(level),frozen,'classification is pure');assert.equal(computeRooms(level).length,rooms.length,'classification does not invent a room boundary');
 assert.equal(wallCategories(updateWall(level,key,{category:'exterior'}))[key],'exterior','explicit estimator classification wins');
 const outside=addWall(level,{a:at([9000,2000]),b:at([12000,2000]),thicknessMm:90});
 assert.equal(wallCategories(outside.level)[outside.wallIds[0]],null,'an unenclosed exterior fragment must remain uncertain');
}
const concave=[[0,0],[8000,0],[8000,8000],[2000,8000],[2000,3000],[1000,3000],[1000,8000],[0,8000]];
const {level}=build(concave);const cut=addWall(level,{a:{x:500,y:6000},b:{x:7500,y:6000},thicknessMm:90});
assert.notEqual(wallCategories(cut.level)[cut.wallIds[0]],'interior','endpoints and midpoint inside cannot hide an interval outside a concave outline');
console.log('Contained partitions: internal enclosure, rotation, manual priority, open exterior and concave exit/re-entry passed.');
