import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { vectorAnalysisFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { normalizePlanAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { canonicalPlanReading } from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';
import { createLevel, deleteWall, mergeDetections } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
const moduleRoot = '../components/construction-estimation/ai-plan-takeoff/';
const spec = { id:'ground', name:'Ground Floor', page:1, pixelsPerMm:.1, logicalWidth:1000, logicalHeight:1000 };
const walls = [
 {id:'north',nodes:[{x:100,y:100},{x:700,y:100}],measuredThicknessMm:90},
 {id:'east',nodes:[{x:700,y:100},{x:700,y:600}],measuredThicknessMm:90},
 {id:'south',nodes:[{x:700,y:600},{x:100,y:600}],measuredThicknessMm:90},
 {id:'west',nodes:[{x:100,y:600},{x:100,y:100}],measuredThicknessMm:90},
];
const context = {jobId:'test-job',takeoffId:'test-takeoff',documentHash:'test-document',pixelsPerMm:.1,pages:[{pageNumber:1,logicalWidth:1000,logicalHeight:1000}],completedWallRuns:[],placedOpenings:[],completedFloorplans:[],sheetLevels:{1:'Ground Floor'}};
const vector = vectorAnalysisFromLinework({walls,openings:[]},spec);
assert.ok(vector.response.walls.every(w=>w.alignment==='center'), 'vector centrelines retain their coordinate convention');
const uncertainVector = vectorAnalysisFromLinework({ walls: [{ id: 'open-segment', nodes: [{ x: 100, y: 800 }, { x: 300, y: 800 }], measuredThicknessMm: 90, category: null }], openings: [] }, spec);
assert.equal(uncertainVector.response.walls.length, 0, 'an open wall segment without category is not promoted into admitted geometry');
assert.equal(uncertainVector.reviewWallCandidates.length, 1, 'the connected model retains uncertain measured geometry for review');
assert.equal(uncertainVector.reviewWallCandidates[0].category, null, 'review candidates do not receive an invented wall category');
assert.equal(uncertainVector.reviewWallCandidates[0].status, 'review-required');
const uncertainHostOpening = vectorAnalysisFromLinework({
	walls: [{ id: 'open-segment', nodes: [{ x: 100, y: 800 }, { x: 300, y: 800 }], measuredThicknessMm: 90, category: null }],
	openings: [{ id: 'opening-on-uncertain-host', x: 200, y: 800, widthMm: 820, kind: 'door', confirmed: true, inWall: true, hostWallIds: ['open-segment'] }],
}, spec);
assert.equal(uncertainHostOpening.response.openings.length, 0, 'an opening on a wall with unknown internal/external class is not promoted to quantity detection');
assert.equal(uncertainHostOpening.reviewOpeningCandidates.length, 1, 'the measured opening point and host identity remain available for review');
assert.equal(uncertainHostOpening.reviewOpeningCandidates[0].hostDetectionKey, 'linework:open-segment');
const normalize = response => normalizePlanAnalysis({context,responses:[response],runId:'regression',modelVersion:'vector-regression'});
const accepted = normalize(vector.response);
const canonical = convertAiTakeoffDetections(accepted.batch,context);
assert.ok(canonical.completedWallRuns.every(w=>w.alignment==='center'), 'normalizer and adapter preserve centrelines');
const source = fs.readFileSync(new URL(moduleRoot+'AIPlanTakeoffStandalone.jsx',import.meta.url),'utf8');
const begin = source.indexOf('function generateOffsetPolygon('),end=source.indexOf('\nexport default function',begin);
const render = vm.runInNewContext(source.slice(begin,end)+'\ngenerateOffsetPolygon');
const points = [{x:10,y:20},{x:110,y:20}];
for (const nodes of [points,[...points].reverse(),points.map(p=>({x:p.y,y:p.x}))]) {
 const polygon=render(nodes,10,'center');
 const centre=polygon.reduce((s,p)=>({x:s.x+p.x/polygon.length,y:s.y+p.y/polygon.length}),{x:0,y:0});
 assert.ok(Math.abs(centre.x-(nodes[0].x+nodes[1].x)/2)<1e-8 && Math.abs(centre.y-(nodes[0].y+nodes[1].y)/2)<1e-8, 'actual canvas renderer straddles the measured centreline');
}
const opening = {detectionId:'window',x:.4,y:.1,widthMm:1200,heightMm:1200,type:'window',openingClass:'Window',basis:'OBSERVED',confidence:.95,evidence:'Window symbol on north wall.'};
for (const hostDetectionId of ['absent-wall','vector-wall-2']) {
 const rejected=normalize({...vector.response,openings:[{...opening,hostDetectionId}]});
 assert.equal(rejected.batch.detections.filter(d=>d.kind==='opening').length,0,'an invalid explicit host cannot be silently replaced by a closer wall');
 assert.ok(rejected.analysis.review.length);
}
const near = normalize({...vector.response,openings:[{...opening,hostDetectionId:'vector-wall-1'}]});
assert.equal(near.batch.detections.filter(d=>d.kind==='opening').length,1,'valid explicit host remains accepted');
const distant = normalize({...vector.response,openings:[{...opening,x:.4,y:.2}]});
assert.equal(distant.batch.detections.filter(d=>d.kind==='opening').length,0,'floating window 1000mm from its wall cannot be counted');
const ambiguous = normalize({...vector.response,openings:[{...opening,x:.1,y:.1}]});
assert.equal(ambiguous.batch.detections.filter(d=>d.kind==='opening').length,0,'equally close walls require a host decision');
console.log('Vector admission regression: centreline rendering, explicit hosts, floating and ambiguous openings passed.');

const junctionReading = canonicalPlanReading({ completedWallRuns: [
	{ id: 'through', nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 }] },
	{ id: 'partition', nodes: [{ x: 1000, y: 500 }, { x: 1000, y: 0 }] },
], placedOpenings: [] }, [], 1);
assert.deepEqual(junctionReading.junctions, [{ x: 1000, y: 0, walls: 2 }], 'canonical application scoring counts shared interior polyline T junctions');

const modelSpec = { a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, thicknessMm: 90, category: null, detectionKey: 'linework:trace-wall' };
const insertedModel = mergeDetections(createLevel({ id: 'trace' }), { walls: [modelSpec] });
assert.equal(insertedModel.report.wallOutcomes.length, 1);
assert.equal(insertedModel.report.wallOutcomes[0].status, 'inserted');
assert.ok(insertedModel.report.wallOutcomes[0].reason);
const duplicateModel = mergeDetections(insertedModel.level, { walls: [modelSpec] });
assert.equal(duplicateModel.report.wallOutcomes[0].status, 'already-present');
const absorbedModel = mergeDetections(insertedModel.level, { walls: [{ ...modelSpec, detectionKey: 'linework:overlapping-wall', a: { x: 100, y: 1 }, b: { x: 900, y: 1 } }] });
assert.equal(absorbedModel.report.wallOutcomes[0].status, 'merged-or-covered');
const originalWallId = Object.values(insertedModel.level.walls)[0].id;
const tombstonedModel = mergeDetections(deleteWall(insertedModel.level, originalWallId), { walls: [modelSpec] });
assert.equal(tombstonedModel.report.wallOutcomes[0].status, 'rejected-before');
