// Additive storage: legacy records and assets are never pruned or migrated here.
// Assets commit before a referencing job/revision can be committed by its caller.
const DATABASE = 'gr8-takeoff-plan-assets-v1';
function openAssets() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('blobs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function putAsset(dataUrl) {
  const bytes = new TextEncoder().encode(dataUrl);
  // Hash only this individual plan asset, never a job/revision collection.
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const db = await openAssets();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite');
      const store = tx.objectStore('blobs');
      const exists = store.getKey(id);
      exists.onsuccess = () => { if (exists.result === undefined) store.add(new Blob([bytes], { type: 'text/plain;charset=utf-8' }), id); };
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Plan asset transaction failed.'));
    });
    return id;
  } finally { db.close(); }
}
export async function readPlanAsset(id) {
  const db = await openAssets();
  try {
    const blob = await new Promise((resolve, reject) => {
      const request = db.transaction('blobs', 'readonly').objectStore('blobs').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!(blob instanceof Blob) || !blob.size) throw new Error(`Missing plan asset ${id}; saved source was not modified.`);
    return await blob.text();
  } finally { db.close(); }
}
async function transformJob(job, encode, assets = new Map()) {
  if (!job || typeof job !== 'object') return job;
  async function pages(source) {
    if (!Array.isArray(source)) return source;
    const result = [];
    for (const page of source) {
      if (encode && typeof page?.dataUrl === 'string' && page.dataUrl.startsWith('data:')) {
        const { dataUrl, ...metadata } = page;
        if (!assets.has(dataUrl)) assets.set(dataUrl, putAsset(dataUrl));
        result.push({ ...metadata, dataUrlAssetId: await assets.get(dataUrl), dataUrlBytes: new TextEncoder().encode(dataUrl).length });
      } else if (!encode && page?.dataUrlAssetId) {
        result.push({ ...page, dataUrl: await readPlanAsset(page.dataUrlAssetId) });
      } else result.push(page);
    }
    return result;
  }
  const result = { ...job };
  if (job.plan?.pages) result.plan = { ...job.plan, pages: await pages(job.plan.pages) };
  if (job.planPages) result.planPages = await pages(job.planPages);
  return result;
}
async function transformWorkbook(workbook, encode) {
  const result = { ...workbook };
  const assets = new Map();
  if (workbook.aiPlanTakeoffJob) result.aiPlanTakeoffJob = await transformJob(workbook.aiPlanTakeoffJob, encode, assets);
  if (workbook.takeoffEngine?.aiPlanTakeoffJob) result.takeoffEngine = {
    ...workbook.takeoffEngine,
    aiPlanTakeoffJob: workbook.takeoffEngine.aiPlanTakeoffJob === workbook.aiPlanTakeoffJob
      ? result.aiPlanTakeoffJob : await transformJob(workbook.takeoffEngine.aiPlanTakeoffJob, encode, assets),
  };
  return result;
}
export const externalizeTakeoffPlanPages = workbook => transformWorkbook(workbook, true);
// Explicit-open callers only. Recovery metadata/export never import this module.
export const materializeTakeoffPlanPages = workbook => transformWorkbook(workbook, false);

export async function externalizeTakeoffRecoverySnapshot(snapshot) {
  const portable = snapshot.portableTakeoff;
  if (!portable) return snapshot;
  const assets = new Map();
  const next = { ...portable };
  if (portable.takeoffData) next.takeoffData = await transformJob(portable.takeoffData, true, assets);
  if (portable.takeoffJob) next.takeoffJob = portable.takeoffJob === portable.takeoffData
    ? next.takeoffData : await transformJob(portable.takeoffJob, true, assets);
  if (portable.plan) next.plan = (await transformJob({ plan: portable.plan }, true, assets)).plan;
  return { ...snapshot, portableTakeoff: next };
}
