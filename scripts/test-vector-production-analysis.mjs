import assert from 'node:assert/strict';
import {vectorProductionAnalysis} from '../components/construction-estimation/ai-plan-takeoff/ai-integration/vectorProductionAnalysis.js';
const spec={id:'test',page:1,name:'Ground Floor',pixelsPerMm:.1,logicalWidth:1000,logicalHeight:1000};
const geometry={walls:[
{id:'a',nodes:[{x:100,y:100},{x:500,y:100}],measuredThicknessMm:90},
{id:'b',nodes:[{x:500,y:100},{x:500,y:500}],measuredThicknessMm:90},
{id:'c',nodes:[{x:500,y:500},{x:100,y:500}],measuredThicknessMm:90},
{id:'d',nodes:[{x:100,y:500},{x:100,y:100}],measuredThicknessMm:90},
],openings:[{id:'window',x:300,y:100,widthMm:1200,hostWallIds:['a'],kind:'window',confirmed:true,inWall:true}]};
const empty={page:1,level:'Ground Floor',walls:[],openings:[],rooms:[],review:[],buildingAreas:[]};
const base=vectorProductionAnalysis(empty,geometry,spec);
const response={...empty,walls:[{detectionId:'approx',category:'interior',nodes:[{x:.1,y:.1},{x:.5,y:.1}],basis:'OBSERVED',confidence:.95,evidence:'Observed internal partition on the drawing.'},{detectionId:'hallucinated',category:'exterior',nodes:[{x:.8,y:.8},{x:.9,y:.8}],basis:'OBSERVED',confidence:.95,evidence:'An unrelated guessed stroke.'}],openings:[{detectionId:'door-label',x:.3,y:.1,type:'door',openingClass:'External Door',basis:'OBSERVED',confidence:.95,evidence:'SGD label',dimensionBasis:'OBSERVED',dimensionEvidence:'Printed dimensions',explicitHeightMm:2100,explicitWidthMm:1200},{detectionId:'missing',x:.9,y:.9,type:'window',openingClass:'Window',basis:'OBSERVED',confidence:.95,evidence:'Unmatched provider proposal'}],rooms:[{name:'Kitchen',x:.3,y:.3,polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1}],basis:'OBSERVED',confidence:.95,evidence:'Room label'}]};
const result=vectorProductionAnalysis(response,geometry,spec);
assert.equal(result.response.walls.length,base.response.walls.length,'a provider wall outside measured linework cannot add geometry');
assert.deepEqual(result.response.walls.map(w=>w.nodes),base.response.walls.map(w=>w.nodes),'provider classification cannot move endpoints');
assert.equal(result.response.walls.find(w=>w.nodes[0].y===.1&&w.nodes[1].y===.1).category,'interior','AI supplies observed classification on the matched measured wall');
assert.equal(result.response.openings.length,1,'an unmatched AI opening cannot create a quantity');
assert.equal(result.response.openings[0].openingClass,'External Door','observed semantics can classify measured glazing');
assert.equal(result.response.openings[0].explicitHeightMm,2100);
assert.deepEqual(result.response.rooms.map(r=>r.polygon),base.response.rooms.map(r=>r.polygon),'an AI room polygon cannot extend measured geometry to the eaves');
assert.ok(result.response.review.some(x=>x.includes('withheld')));
console.log('Production vector path: measured geometry, evidence-based semantics, documentary dimensions and unmatched-proposal withholding passed.');
// A documented square-set opening may close only its existing measured gap.
const divided={...geometry,engine:'fixture-only',walls:[...geometry.walls,{id:'left',nodes:[{x:100,y:300},{x:250,y:300}],measuredThicknessMm:90},{id:'right',nodes:[{x:350,y:300},{x:500,y:300}],measuredThicknessMm:90}],openings:[{id:'gap',x:300,y:300,direction:{x:1,y:0},widthMm:1000,hostThicknessMm:90,hostWallIds:['left','right'],kind:'opening',confirmed:false}]};
const note={x:.3,y:.3,type:'door',openingClass:'Other Opening',basis:'OBSERVED',confidence:.95,evidence:'Printed square-set opening annotation',dimensionBasis:'OBSERVED',dimensionEvidence:'Printed 2100 x 1000 opening',explicitWidthMm:1000,explicitHeightMm:2100};
const untouched=JSON.stringify(divided),unconfirmed=vectorProductionAnalysis(empty,divided,spec);
const confirmed=vectorProductionAnalysis({...empty,openings:[note]},divided,spec);
assert.equal(confirmed.vector.report.documentedGapConfirmations,1);
assert.equal(confirmed.vector.rooms.length,unconfirmed.vector.rooms.length+1,'only the documented measured span closes the partition');
assert.equal(confirmed.response.openings[0].openingClass,'Other Opening','a square-set opening must not become an internal hinged door');
assert.equal(JSON.stringify(divided),untouched,'provider confirmation cannot mutate captured linework');
for(const changed of [{explicitWidthMm:3000},{x:.9},{dimensionBasis:'ASSUMED'},{dimensionEvidence:''},{confidence:.6}]){
 const result=vectorProductionAnalysis({...empty,openings:[{...note,...changed}]},divided,spec);assert.equal(result.vector.report.documentedGapConfirmations,0,JSON.stringify(changed));assert.equal(result.vector.rooms.length,unconfirmed.vector.rooms.length);
}
assert.equal(vectorProductionAnalysis({...empty,openings:[note,{...note}]},divided,spec).vector.report.documentedGapConfirmations,0,'duplicate/ambiguous annotations cannot confirm a gap');
const provisional={...geometry,openings:geometry.openings.map(o=>({...o,needsClassification:true}))};
assert.equal(vectorProductionAnalysis(empty,provisional,spec).response.openings[0].needsClassification,true);
assert.equal(vectorProductionAnalysis(response,provisional,spec).response.openings[0].needsClassification,false,'matched observed semantics resolve the provisional frame type');
console.log('Documented gap admission and provisional type gating: positive, ambiguity, evidence, width, confidence and position checks passed.');
const {buildLocalVectorAnalysis}=await import('../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js');
const planPage={pageNumber:1,logicalWidth:1000,logicalHeight:1000};
const context={jobId:'persisted-evidence-job',takeoffId:'persisted-evidence-job',documentHash:'fixture',pixelsPerMm:.1,pages:[planPage],completedWallRuns:[],placedOpenings:[],sheetLevels:{1:'Ground Floor'}};
const local=buildLocalVectorAnalysis({planPage,detected:divided,pixelsPerMm:.1,level:'Ground Floor',context,runId:'restore',semanticInput:JSON.parse(JSON.stringify({...empty,openings:[note],rooms:[{name:'Kitchen',x:.3,y:.2,basis:'OBSERVED',confidence:.95}]}))});
assert.equal(local.vector.report.documentedGapConfirmations,1,'saved documentary evidence must survive the local correction path');
assert.equal(local.vector.rooms.length,2);assert.ok(local.vector.rooms.some(r=>r.name==='Kitchen'),'the saved plan label survives a local correction rebuild');
const manual=vectorProductionAnalysis(response,geometry,spec,{wallDecisions:{'linework:a':'exterior'}});
assert.equal(manual.response.walls.find(w=>w.nodes[0].y===.1&&w.nodes[1].y===.1).category,'exterior','explicit estimator classification takes priority over saved AI semantics');
console.log('Saved semantic evidence: local correction rebuild retains documented gaps and labels; manual decisions remain authoritative.');
