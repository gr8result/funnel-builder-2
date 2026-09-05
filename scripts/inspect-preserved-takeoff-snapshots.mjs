import fs from 'node:fs';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (!isMainThread) {
  const record = JSON.parse(fs.readFileSync(workerData, 'utf8'));
  const candidates = [];
  function inspect(value, location) {
    if (!value || typeof value !== 'object') return;
    const pages = value.plan?.pages || value.planPages;
    const groups = ['completedWallRuns','placedOpenings','completedAreas','completedFloorplans','completedMeasurements','completedEaves'];
    if (Array.isArray(pages) || groups.some(key => Array.isArray(value[key]))) {
      const overlays = groups.flatMap(key => (value[key] || []).map(overlay => ({...overlay, group:key})));
      candidates.push({location, name:value.takeoffName || value.jobName, pages:(pages||[]).map((page,index)=>({ page:page.pageNumber || index+1, bytesPresent:typeof page.dataUrl==='string' && /^data:(image|application\/pdf)\//.test(page.dataUrl), embeddedCharacters:page.dataUrl?.length || 0, assetId:page.dataUrlAssetId || null, overlays:overlays.filter(o=>Number(o.page || o.pageId || 1)===Number(page.pageNumber || index+1)).length })), overlayCount:overlays.length, counts:Object.fromEntries(groups.map(key=>[key,value[key]?.length || 0]))});
    }
    for (const [key, child] of Object.entries(value)) inspect(child,location+'.'+key);
  }
  inspect(record,'record');
  parentPort.postMessage({file:path.basename(workerData),key:record.key,timestamp:record.savedAt,candidates});
} else {
  const dir=path.resolve(process.argv[2] || 'recovery/emergency-2026-09-05T00-42-37-307Z');
  const rows=[];
  const files=fs.readdirSync(dir).filter(f=>f.includes('_snapshot_')&&f.endsWith('.raw.json')).sort().reverse();
  for(const file of files){
    const row=await new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:path.join(dir,file)});w.on('message',resolve);w.on('error',reject);});
    rows.push(row);
    console.log(row.key, JSON.stringify(row.candidates));
  }
  fs.writeFileSync('recovery/snapshot-content-inspection.json',JSON.stringify({inspectedAt:new Date().toISOString(),directory:dir,rows},null,2));
}
