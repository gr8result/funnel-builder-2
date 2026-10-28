import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
const pair = (ax, ay, bx, by) => {
  const length = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / length * 4.5, ny = (bx - ax) / length * 4.5;
  return [-1, 1].map(k => ({ x1: ax + k * nx, y1: ay + k * ny, x2: bx + k * nx, y2: by + k * ny, paint: 'stroke', widthPx: .3, color: '#000000' }));
};
for (const angle of [0, Math.PI / 4]) for (const scale of [1, .2834645669291339]) {
  const transform = s => { const p = (x, y) => ({ x: (x * Math.cos(angle) - y * Math.sin(angle) + 1000) * scale, y: (x * Math.sin(angle) + y * Math.cos(angle) + 1000) * scale }); const a=p(s.x1,s.y1),b=p(s.x2,s.y2); return {...s,x1:a.x,y1:a.y,x2:b.x,y2:b.y,widthPx:s.widthPx*scale}; };
  for (const distant of [true, false]) {
    const source = [...pair(100, 100, 300, 100), ...pair(335, 100, 535, 100), ...pair(317.5, distant ? 500 : 104.5, 317.5, 800)];
    const result = detectVectorWalls(source.map(transform), { pixelsPerMm: .1*scale, logicalWidth: 3000*scale, logicalHeight:3000*scale }, { buildingShare: 0 });
    const runs = result.walls.filter(w => Math.abs(w.angle-angle)<1e-5);
    assert.equal(runs.length, distant ? 2 : 1, `Only a crossing at the gap may join wall faces (distant=${distant}, rotation=${angle}, scale=${scale})`);
    assert.ok(runs.every(w => distant ? w.lengthMm === 2000 : w.lengthMm === 4350));
  }
}
console.log('Vector continuity regression: local vs distant crossings, rotation and scale passed.');
const continuousFace = [
  ...pair(100, 100, 300, 100), ...pair(335, 100, 535, 100),
  ...pair(317.5, 500, 317.5, 800),
  { x1: 100, y1: 95.5, x2: 535, y2: 95.5, paint: 'stroke', widthPx: .3, color: '#000000' },
];
const continuousResult = detectVectorWalls(continuousFace, { pixelsPerMm: .1, logicalWidth: 1000, logicalHeight: 1000 }, { buildingShare: 0 });
const continuousRuns = continuousResult.walls.filter(wall => Math.abs(wall.angle) < 1e-5);
assert.equal(continuousRuns.length, 1, 'An existing projected crossing candidate requires a continuously drawn shared face when its finite run does not reach');
assert.equal(continuousRuns[0].lengthMm, 4350);
// Dashed demolition/overhead symbols must not become physical hinged doors.
const box = [...pair(100,100,700,100),...pair(700,100,700,600),...pair(700,600,100,600),...pair(100,600,100,100)];
const swing = Array.from({length:12},(_,i)=>{const a=-Math.PI/2*i/12,b=-Math.PI/2*(i+1)/12;return {x1:300+82*Math.cos(a),y1:100+82*Math.sin(a),x2:300+82*Math.cos(b),y2:100+82*Math.sin(b),curve:true,path:100,subpath:100,paint:'stroke',widthPx:.3,color:'#000000'};});
for (const dashed of [false,true]) {
 const result=detectVectorWalls([...box,...swing.map(s=>({...s,dashed}))],{pixelsPerMm:.1,logicalWidth:1000,logicalHeight:1000});
 assert.equal(result.openings.filter(o=>o.kind==='door').length,dashed?0:1,'only a solid swing may establish a door');
}
