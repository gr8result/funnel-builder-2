self.onmessage = async () => {
 let db;
 try {
  db = await new Promise((resolve,reject)=>{const r=indexedDB.open('estimate-builder-template-db');r.onupgradeneeded=()=>r.transaction.abort();r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
  const record = await new Promise((resolve,reject)=>{const r=db.transaction('jobs','readonly').objectStore('jobs').get('job:03-09/123');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const a=record?.workbook?.aiPlanTakeoffJob,b=record?.workbook?.takeoffEngine?.aiPlanTakeoffJob;
  postMessage({key:record?.key,savedAt:record?.savedAt,canonicalType:Object.prototype.toString.call(a),canonicalKeys:Object.keys(a||{}),compatibilityKeys:Object.keys(b||{}),pages:(a?.plan?.pages||a?.planPages||b?.plan?.pages||[]).length});
 }catch(e){postMessage({error:e.message});}finally{db?.close();}
};
