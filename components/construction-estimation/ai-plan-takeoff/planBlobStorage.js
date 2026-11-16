// Additive storage: legacy records and assets are never pruned or migrated here.
// Assets commit before a referencing job/revision can be committed by its caller.
import { knownAsset, rememberAssetId } from '../../../lib/construction-estimation/knownAssetIds.js';

const DATABASE = 'gr8-takeoff-plan-assets-v1';
function openAssets() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('blobs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
// Every save externalizes the same unchanged images again. Encoding and hashing each one (often
// ~90 MB of proposal artwork) on every save only produced large short-lived buffers, which is what
// pushed the tab towards out-of-memory during repeated saves. Remember each stored image's id for
// this session (bounded; the strings are the ones the open job already holds) and confirm the asset
// is still present with a key lookup, re-encoding only when it is not.
function rememberAsset(dataUrl, id, byteLength) { rememberAssetId(dataUrl, id, byteLength); }
function assetByteLength(dataUrl) {
  return knownAsset(dataUrl)?.byteLength ?? new TextEncoder().encode(dataUrl).length;
}
async function assetPresent(id) {
  const db = await openAssets();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('blobs', 'readonly').objectStore('blobs').getKey(id);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function putAsset(dataUrl) {
  const known = knownAsset(dataUrl);
  if (known && await assetPresent(known.id)) return known.id;
  const id = await storeAsset(dataUrl);
  return id;
}
async function storeAsset(dataUrl) {
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
    rememberAsset(dataUrl, id, bytes.length);
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
    const text = await blob.text();
    rememberAsset(text, id, blob.size);
    return text;
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
        const dataUrlAssetId = await assets.get(dataUrl);
        result.push({ ...metadata, dataUrlAssetId, dataUrlBytes: assetByteLength(dataUrl) });
      } else if (!encode && page?.dataUrlAssetId && !(typeof page?.dataUrl === 'string' && page.dataUrl.startsWith('data:'))) {
        // Only reach for the local asset store when the page has no image of its own.
        // A job file carried from another machine embeds the image but keeps the asset
        // id from where it was saved; preferring the id there would look up an asset
        // this profile has never held, throw, and leave the takeoff page blank.
        // A job opened in a browser that never held this image (e.g. a job file whose plan images
        // stayed in another profile's asset store) must still open: keep the page and its asset id
        // unchanged, so nothing is lost and a later save keeps the reference. Only the image is absent.
        let dataUrl = null;
        try { dataUrl = await readPlanAsset(page.dataUrlAssetId); } catch (error) {
          if (!/^Missing plan asset /.test(error?.message || '')) throw error;
          console.warn(`[Plan assets] ${error.message} The page opens without its image.`);
        }
        result.push(dataUrl === null ? page : { ...page, dataUrl });
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
  // Imported quotation artwork used to be repeated in page.baseArtwork,
  // design.backgroundImageUrl and importedDocument.baseArtwork, in every
  // revision. Keep one durable asset, restoring the original string fields on
  // explicit open/export. The per-operation map is released after completion.
  async function artwork(value) {
    if (encode && typeof value === 'string' && value.startsWith('data:')) {
      if (!assets.has(value)) assets.set(value, putAsset(value));
      return { __gr8StoredDataUrl: await assets.get(value) };
    }
    if (!value || typeof value !== 'object') return value;
    if (!encode && typeof value.__gr8StoredDataUrl === 'string' && Object.keys(value).length === 1) {
      const id = value.__gr8StoredDataUrl;
      // Same rule as plan pages: artwork this browser never held must not stop the job (and its
      // quotation) opening. Keep the reference unchanged so a later save keeps it; only the image is absent.
      if (!assets.has(id)) assets.set(id, readPlanAsset(id).catch((error) => {
        if (!/^Missing plan asset /.test(error?.message || '')) throw error;
        console.warn(`[Plan assets] ${error.message} The document opens without this artwork.`);
        return { __gr8StoredDataUrl: id };
      }));
      return assets.get(id);
    }
    if (Array.isArray(value)) {
      const output = [];
      for (const item of value) output.push(await artwork(item));
      return output;
    }
    const output = {};
    for (const key of Object.keys(value)) Object.defineProperty(output, key, { value: await artwork(value[key]), enumerable: true, writable: true, configurable: true });
    return output;
  }
  if (workbook.projectEstimateBuilder) result.projectEstimateBuilder = await artwork(workbook.projectEstimateBuilder);
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

export async function materializeTakeoffRecoverySnapshot(snapshot) {
  const portable = snapshot?.portableTakeoff;
  if (!portable) return snapshot;
  const next = { ...portable };
  if (portable.takeoffData) next.takeoffData = await transformJob(portable.takeoffData, false);
  if (portable.takeoffJob) next.takeoffJob = portable.takeoffJob === portable.takeoffData
    ? next.takeoffData : await transformJob(portable.takeoffJob, false);
  if (portable.plan) next.plan = (await transformJob({ plan: portable.plan }, false)).plan;
  return { ...snapshot, portableTakeoff: next };
}
