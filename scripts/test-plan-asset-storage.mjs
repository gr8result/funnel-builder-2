import assert from 'node:assert/strict';

// Plan / artwork asset store: repeated saves reuse stored ids without re-encoding, a store that lost
// an asset gets it written again, and a page whose image this browser never held still opens with
// its reference intact (it used to make the whole job fail to load: "Missing plan asset").
// Minimal in-memory IndexedDB stand-in (only what planBlobStorage.js uses).
const blobs = new Map();
const stats = { adds: 0, encodes: 0 };
const later = fn => setTimeout(fn, 0);
globalThis.indexedDB = {
  open() {
    const request = {};
    later(() => {
      request.result = {
        close() {},
        createObjectStore() {},
        transaction() {
          const tx = {};
          let pending = 0;
          const done = () => later(() => { if (pending === 0) tx.oncomplete?.(); });
          const op = (fn) => { const r = {}; pending++; later(() => { r.result = fn(); pending--; r.onsuccess?.(); done(); }); return r; };
          tx.objectStore = () => ({
            getKey: id => op(() => (blobs.has(id) ? id : undefined)),
            get: id => op(() => blobs.get(id)),
            add: (value, id) => { stats.adds++; blobs.set(id, value); },
          });
          return tx;
        },
      };
      request.onsuccess?.();
    });
    return request;
  },
};
const RealEncoder = globalThis.TextEncoder;
globalThis.TextEncoder = class extends RealEncoder { encode(value) { stats.encodes++; return super.encode(value); } };

const { externalizeTakeoffPlanPages, materializeTakeoffPlanPages } = await import('../components/construction-estimation/ai-plan-takeoff/planBlobStorage.js');
const image = `data:image/png;base64,${'A'.repeat(200000)}`;
const art = `data:image/jpeg;base64,${'B'.repeat(300000)}`;
const workbook = () => ({
  aiPlanTakeoffJob: { plan: { pages: [{ id: 'p1', dataUrl: image }] } },
  projectEstimateBuilder: { pages: [{ baseArtwork: art, design: { backgroundImageUrl: art } }] },
});

const first = await externalizeTakeoffPlanPages(workbook());
const id = first.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId;
assert.match(id, /^[0-9a-f]{64}$/);
assert.equal(first.aiPlanTakeoffJob.plan.pages[0].dataUrlBytes, image.length);
assert.equal(first.aiPlanTakeoffJob.plan.pages[0].dataUrl, undefined);
assert.deepEqual(first.projectEstimateBuilder.pages[0].baseArtwork, first.projectEstimateBuilder.pages[0].design.backgroundImageUrl);
assert.equal(stats.adds, 2, 'two distinct images stored once each');
console.log('PASS first save stores each distinct image once');

const encodesBefore = stats.encodes;
for (let save = 0; save < 5; save++) {
  const again = await externalizeTakeoffPlanPages(workbook());
  assert.deepEqual(again, first, 'unchanged images keep the same references');
}
assert.equal(stats.encodes, encodesBefore, 'repeated saves of unchanged images encode nothing');
assert.equal(stats.adds, 2);
console.log('PASS five more saves: same references, no re-encoding, nothing rewritten');

blobs.delete(id);
const restored = await externalizeTakeoffPlanPages(workbook());
assert.equal(restored.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId, id);
assert(blobs.has(id), 'an asset missing from the store is written again on the next save');
console.log('PASS a store that lost an asset gets it back on the next save');

const opened = await materializeTakeoffPlanPages(first);
assert.equal(opened.aiPlanTakeoffJob.plan.pages[0].dataUrl, image);
assert.equal(opened.projectEstimateBuilder.pages[0].baseArtwork, art);
console.log('PASS open restores plan pages and artwork');

const foreign = { aiPlanTakeoffJob: { plan: { pages: [{ id: 'p9', dataUrlAssetId: 'f'.repeat(64), dataUrlBytes: 10 }] } } };
const warn = console.warn; let warned = ''; console.warn = message => { warned = String(message); };
const openedForeign = await materializeTakeoffPlanPages(foreign);
console.warn = warn;
assert.deepEqual(openedForeign.aiPlanTakeoffJob.plan.pages[0], foreign.aiPlanTakeoffJob.plan.pages[0], 'page kept unchanged, reference intact');
assert.match(warned, /Missing plan asset/);
const resaved = await externalizeTakeoffPlanPages(openedForeign);
assert.equal(resaved.aiPlanTakeoffJob.plan.pages[0].dataUrlAssetId, 'f'.repeat(64), 'a later save keeps the reference');
console.log('PASS a plan image this browser never held no longer stops the job opening; its reference survives a save');
console.log('Plan asset storage: all checks passed.');
