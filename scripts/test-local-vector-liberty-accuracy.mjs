import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {detectVectorWalls} from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import {buildLocalVectorAnalysis} from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import {convertAiTakeoffDetections} from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import {canonicalPlanReading,compareWalls,compareOpenings,compareRooms} from '../components/construction-estimation/ai-plan-takeoff/geometry/planAccuracy.js';
import { privateTestDataUrl } from './lib/privateTestData.mjs';
const fixture=new URL(privateTestDataUrl('vector-regression-2026-10-18','frozen'));
const input=JSON.parse(fs.readFileSync(new URL('application-input.json',fixture)));
const image=await loadImage(fs.readFileSync(new URL('application-raster.png',fixture)));
const canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);
const raster=canvas.getContext('2d').getImageData(0,0,image.width,image.height);raster.storedPixelsPerMm=input.storedPixelsPerMm;
const detected=detectVectorWalls(input.vectorSegments,{...input,raster});
const context={jobId:'liberty-regression',takeoffId:'liberty-regression',documentHash:'captured-liberty',pixelsPerMm:input.pixelsPerMm,pages:[input],completedWallRuns:[],placedOpenings:[],sheetLevels:{1:'Ground Floor'}};
const result=buildLocalVectorAnalysis({planPage:input,detected,pixelsPerMm:input.pixelsPerMm,level:'Ground Floor',context,runId:'accuracy'});
const canonical=convertAiTakeoffDetections(result.batch,context);
const reading=canonicalPlanReading(canonical,result.rooms,input.pixelsPerMm);
// Reference enters only after the application reading is complete.
const reference=JSON.parse(fs.readFileSync(new URL('reference.json',fixture)));
const mm=point=>({x:point.x/input.pixelsPerMm,y:point.y/input.pixelsPerMm});
const walls=compareWalls(reference.walls.map(w=>({...w,a:mm(w.a),b:mm(w.b)})),reading.walls);
const openings=compareOpenings(reference.openings.map(o=>({...o,...mm(o)})),reading.openings);
const rooms=compareRooms(reference.rooms.map(r=>({...r,polygon:r.polygon.map(mm)})),reading.rooms);
// Floors raised 2026-11-15 after the dashed-head, barn-door and wall-continuation repairs
// (recall 0.987, 32/33 without OCR; the 33rd, the Bed 1 WIR, is settled by its printed label via OCR).
assert.ok(walls.recall>=.98,`Liberty wall recall regressed: ${walls.recall}`);
assert.ok(walls.precision>=.985,`Liberty wall precision regressed: ${walls.precision}`);
assert.ok(openings.matched>=32,`Liberty matched openings regressed: ${openings.matched}`);
assert.ok(rooms.matched>=9,`Liberty room candidates regressed: ${rooms.matched}`);
assert.ok(canonical.placedOpenings.every(o=>o.widthMm>0),'calibrated widths must survive normalization and canonical admission');
// No silent acceptance: every gap with nothing drawn in it waits for the builder's classification.
assert.ok(canonical.placedOpenings.filter(o=>o.unconfirmed).every(o=>o.needsClassification),'unconfirmed gaps need classification before quantities');
const heldIds=new Set(canonical.placedOpenings.filter(o=>o.needsClassification).map(o=>o.ai?.detectionId||o.id));
assert.deepEqual(openings.extra.filter(o=>!heldIds.has(o.id)).map(o=>o.id),[],'no confirmed opening outside the reference (collinear wall remnants cannot become an additional wide slider)');
assert.ok(result.rooms.every(r=>!r.confirmed),'candidate accuracy must not silently approve rooms');
const rerunContext={...context,completedWallRuns:canonical.completedWallRuns,placedOpenings:canonical.placedOpenings};
const rerun=buildLocalVectorAnalysis({planPage:input,detected,pixelsPerMm:input.pixelsPerMm,level:'Ground Floor',context:rerunContext,runId:'rerun'});
assert.equal(rerun.batch.detections.length,0,'same-plan rerun must not duplicate accepted quantities');
console.log(JSON.stringify({wallRecall:walls.recall,wallPrecision:walls.precision,openingsMatched:openings.matched,openingCount:canonical.placedOpenings.length,typeReview:canonical.placedOpenings.filter(o=>o.needsClassification).length,roomCandidatesMatched:rooms.matched,confirmedRooms:result.rooms.filter(r=>r.confirmed).length}));
