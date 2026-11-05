import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { levelFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { wallCategories } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';

function entrance(scale, angle) {
  const segments = [], c = Math.cos(angle), s = Math.sin(angle);
  const P = ([x,y]) => ({ x: (20000+x*c-y*s)*scale, y: (20000+x*s+y*c)*scale });
  const line = (a,b,tag,path=1000) => {
    const p=P(a),q=P(b); segments.push({x1:p.x,y1:p.y,x2:q.x,y2:q.y,path,subpath:0,
      paint:'stroke',widthPx:.24,color:'#000000',tag});
  };
  for (const x of [-35,35]) line([x,35],[x,8000], 'body');
  for (const x of [9965,10035]) line([x,35],[x,8000], 'body');
  for (const y of [7965,8035]) line([-35,y],[10035,y], 'body');
  for (const y of [-35,35]) {line([35,y],[2965,y],'body');line([7035,y],[9965,y],'body');}
  for (const x of [2965,3035,6965,7035]) line([x,35],[x,800], 'anchor');
  line([2965,800],[3450,800],'return');line([6550,800],[7035,800],'return');
  line([3035,890],[6965,890],'back');
  line([3450,840],[4100,840],'pane');line([5900,840],[6550,840],'pane');
  line([3450,750],[6550,750],'header');
  for (const x of [3450,6550]) line([x,750],[x,890],'cap',1001);
  for (const x of [4100,5900]) line([x,750],[x,1790],'leaf',1002);
  for (const [x,sign,path] of [[4100,1,2000],[5900,-1,2001]]) {
    for(let i=0;i<12;i++) {
      const point=j=>[x+sign*900*Math.cos(j*Math.PI/24),890+900*Math.sin(j*Math.PI/24)];
      line(point(i),point(i+1),'swing',path);segments.at(-1).curve=true;
    }
  }
  return {segments,P,context:{pixelsPerMm:scale,logicalWidth:50000*scale,logicalHeight:50000*scale,textItems:[]}};
}
for(const scale of [.0283,.09]) for(const angle of [0,Math.PI/4,Math.PI/2]) {
  const {segments,context}=entrance(scale,angle);
  const read=parts=>detectVectorWalls(parts,context);
  const assembly=result=>result.openings.filter(o=>o.evidence.includes('measured glazed entrance'));
  const found=read(segments), openings=assembly(found);
  assert.equal(openings.length,3,'two sidelights and one paired doorway from complete measured assembly');
  assert.deepEqual(openings.map(o=>o.kind),['window','door','window']);
  assert.deepEqual(openings.map(o=>o.widthMm),[650,1800,650]);
  const built=levelFromLinework(found,{...context,page:1,id:"entrance-test"});
  const categories=wallCategories(built.level);
  assert.ok(Object.values(categories).includes('exterior'),'measured assembly closes a real perimeter');
  for(const tag of ['cap','header','swing','leaf','anchor']) {
    assert.equal(assembly(read(segments.filter(s=>s.tag!==tag))).length,0,`missing ${tag} cannot establish assembly`);
  }
  const singleMissingCap=segments.filter(s=>s!==segments.find(part=>part.tag==='cap'));
  assert.equal(assembly(read(singleMissingCap)).length,0,'one missing outer cap is enough to withhold assembly');
  assert.equal(assembly(read(segments.filter(s=>s.path!==2000))).length,0,'one swing cannot establish paired doors');
  assert.ok(found.walls.some(w=>w.lengthMm>7000&&Math.abs(w.measuredThicknessMm-70)<1),'long real walls preserved');
  // A solid paired partition instead of thin panes is a wall, not a sidelight.
  const solid=segments.map(s=>({...s}));
  for(const line of solid.filter(s=>s.tag==='pane')) {
    const normal={x:-Math.sin(angle),y:Math.cos(angle)};
    line.x1-=normal.x*100*scale;line.x2-=normal.x*100*scale;
    line.y1-=normal.y*100*scale;line.y2-=normal.y*100*scale;
  }
  assert.equal(assembly(read(solid)).length,0,'solid wall faces are not promoted to glazing');
}
console.log('Measured glazed entrance: capped panes, surround, two swings, radial leaves and wall anchors required; rotated/scaled real-wall negatives passed.');
