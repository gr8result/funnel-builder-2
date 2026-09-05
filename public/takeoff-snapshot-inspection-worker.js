// Read-only, one record per disposable worker. No plan payload reaches the page.
self.onmessage = async ({data}) => {
 let db;
 try {
  db=await new Promise((resolve,reject)=>{const r=indexedDB.open('estimate-builder-template-db');r.onupgradeneeded=()=>r.transaction.abort();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  if(data.action==='keys') {
   const keys=await new Promise((resolve,reject)=>{const result=[];const r=db.transaction('jobs','readonly').objectStore('jobs').openKeyCursor(IDBKeyRange.bound('job:03-09/123','job:03-09/123\uffff'));r.onsuccess=()=>{const c=r.result;if(!c)return resolve(result);if(c.key==='job:03-09/123'||String(c.key).startsWith('job:03-09/123:snapshot:'))result.push(c.key);c.continue();};r.onerror=()=>reject(r.error);});
   postMessage({keys:keys.reverse()});return;
  }
  const record=await new Promise((resolve,reject)=>{const r=db.transaction('jobs','readonly').objectStore('jobs').get(data.key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const candidates=[];
  function inspect(value,location){
   if(!value||typeof value!=='object')return;
   const pages=value.plan?.pages||value.planPages;
   const groups=['completedWallRuns','placedOpenings','completedAreas','completedFloorplans','completedMeasurements','completedEaves'];
   if(Array.isArray(pages)||groups.some(k=>Array.isArray(value[k]))){
    const overlays=groups.flatMap(k=>value[k]||[]);
    candidates.push({location,name:value.takeoffName||value.jobName,pageCount:pages?.length||0,overlayCount:overlays.length,pages:(pages||[]).map((p,i)=>({page:p.pageNumber||i+1,bytesPresent:typeof p.dataUrl==='string'&&p.dataUrl.startsWith('data:'),embeddedCharacters:p.dataUrl?.length||0,assetId:p.dataUrlAssetId||null,overlays:overlays.filter(o=>Number(o.page||o.pageId||1)===Number(p.pageNumber||i+1)).length})),counts:Object.fromEntries(groups.map(k=>[k,value[k]?.length||0]))});
   }
   for(const [key,child]of Object.entries(value))inspect(child,location+'.'+key);
  }
  inspect(record,'record');
  postMessage({key:data.key,timestamp:record?.savedAt,candidates});
 }catch(e){postMessage({error:e.message,key:data.key});}finally{db?.close();}
};
