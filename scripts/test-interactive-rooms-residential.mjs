import fs from 'node:fs';
import sharp from 'sharp';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { analyseTakeoffPage, validateTakeoffAnalysisRequest } from '../lib/construction-estimation/aiTakeoffAnalysis.js';
import { detectRoomBoundary } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomGeometry.js';
dotenv.config({path:'.env.local',quiet:true});
const out='artifacts/test-results/interactive-rooms';fs.mkdirSync(out,{recursive:true});
const saved=JSON.parse(fs.readFileSync('artifacts/test-results/integrated-takeoff-smooth-save/downloads/Johnson 123.gr8takeoff','utf8'));
const result=[];
for(const pageNumber of [2,3]) {
  const page=saved.plan.pages.find(p=>p.pageNumber===pageNumber);
  const image=await sharp(Buffer.from(page.dataUrl.split(',')[1],'base64')).resize({width:2400,height:2400,fit:'inside'}).jpeg({quality:90}).toBuffer();
  const level=pageNumber===2?'Ground Floor':'Second Level';
  const request=validateTakeoffAnalysisRequest({action:'measure',measurementScope:'rooms',jobId:'isolated-room-acceptance',takeoffId:'room-acceptance',documentHash:'residential-sample-plans',runId:'rooms-from-plans-v1',pixelsPerMm:saved.takeoffData.pixelsPerMm,page:{pageNumber,logicalWidth:page.logicalWidth,logicalHeight:page.logicalHeight,imageDataUrl:`data:image/jpeg;base64,${image.toString('base64')}`,textItems:[],drawingType:'floor_plan',level}});
  const file=`${out}/sheet-${pageNumber}-response.json`;
  if (!fs.existsSync(file) && process.env.ROOM_REAL_AI_APPROVED !== '1') throw new Error('Live validation sends two private test sheets to the configured provider. Obtain explicit approval before setting ROOM_REAL_AI_APPROVED=1. Cached responses can be replayed locally without it.');
  const response=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):await analyseTakeoffPage(request,{apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_TAKEOFF_MODEL});
  fs.writeFileSync(file,JSON.stringify(response,null,2));
  const {data,info}=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const rooms=response.analysis.rooms.map((raw,index)=>detectRoomBoundary(raw,{page:pageNumber,level,width:page.logicalWidth,height:page.logicalHeight,pixelsPerMm:saved.takeoffData.pixelsPerMm,walls:saved.takeoffData.completedWallRuns||[],raster:{width:info.width,height:info.height,data}},index));
  result.push(...rooms);
  console.log(`Sheet ${pageNumber}: ${rooms.length} rooms, ${rooms.filter(r=>r.polygon.length>=3).length} boundaries, ${rooms.filter(r=>r.reviewRequired).length} require review`);
}
fs.writeFileSync(`${out}/rooms.json`,JSON.stringify(result,null,2));
for(const [name,pattern] of [['Bedroom',/bed/i],['Kitchen',/kitchen/i],['Bathroom',/bath/i],['Ensuite',/ensuite/i],['Laundry',/laundry/i],['Garage',/garage/i],['Alfresco',/alfresco|patio/i]]) {
  const room=result.find(r=>pattern.test(r.name));assert(room,`${name} detected`);assert(room.areaM2>0,`${name} has measurable polygon`);assert(room.perimeterM>0);console.log(`${room.name}: ${room.areaM2.toFixed(2)} m² / ${room.perimeterM.toFixed(2)} m${room.reviewRequired?' — REVIEW':''}`);
}
