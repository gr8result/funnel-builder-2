async function openExisting(name) {
 return new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onupgradeneeded=()=>r.transaction.abort();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
function summarize(record) {
 const candidates=[];
 function visit(v,location){
  if(!v||typeof v!=='object')return;
  const pages=v.plan?.pages||v.planPages;
  if(Array.isArray(pages)||v.takeoffName||v.jobName||v.portableTakeoff){
   const arrays=['completedWallRuns','placedOpenings','completedAreas','completedFloorplans','completedMeasurements','completedEaves'];
   candidates.push({location,name:v.takeoffName||v.jobName||v.name,id:v.takeoffId||v.id||v.jobId,updatedAt:v.updatedAt||v.savedAt,pageCount:pages?.length||0,pages:(pages||[]).map(p=>({page:p.pageNumber,bytes:p.dataUrl?.length||0,assetId:p.dataUrlAssetId})),counts:Object.fromEntries(arrays.map(k=>[k,v[k]?.length||0]))});
  }
  for(const [k,c]of Object.entries(v))visit(c,location+'.'+k);
 }
 visit(record,'record');
 return {name:record?.name,key:record?.key,savedAt:record?.savedAt,jobId:record?.jobId,candidates};
}
self.onmessage=async({data})=>{
 let db;
 try{
  if(data.action==='inventory'){
   const inventory=[];
   for(const info of await indexedDB.databases()){
    if(!/takeoff|estimate/i.test(info.name))continue;
    db=await openExisting(info.name);
    for(const store of db.objectStoreNames){
     const keys=await new Promise((resolve,reject)=>{const keys=[];const r=db.transaction(store,'readonly').objectStore(store).openKeyCursor();r.onsuccess=()=>{const c=r.result;if(!c)return resolve(keys);keys.push(c.key);c.continue();};r.onerror=()=>reject(r.error);});
     inventory.push({database:info.name,store,keys});
    }
    db.close();db=null;
   }
   postMessage({inventory});return;
  }
  db=await openExisting(data.database);
  const value=await new Promise((resolve,reject)=>{const r=db.transaction(data.store,'readonly').objectStore(data.store).get(data.key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  postMessage({database:data.database,store:data.store,key:data.key,summary:summarize(value)});
 }catch(e){postMessage({error:e.message});}finally{db?.close();}
};
