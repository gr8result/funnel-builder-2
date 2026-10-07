import { documentLock } from "../nonStealingLock.js";
export const DATABASE = "gr8-project-estimate-page-builder-v1";
export const uid = () => crypto.randomUUID();
export const blankPage = () => ({ id: uid(), blocks: [] });
export function blankDocument(workspace, job) {
  return { id: uid(), workspace, job, kind: "estimate", name: "Untitled estimate", revision: 0, pages: [blankPage()] };
}
export function validateDocument(doc, workspace, job) {
  if (!doc || !doc.id || doc.workspace !== workspace || doc.job !== job) throw Error("Document identity does not match this workspace and job.");
  if (!Array.isArray(doc.pages) || !doc.pages.length || doc.pages.some(p => !p.id || !Array.isArray(p.blocks) || p.blocks.some(b => !b.id || !['text','image','table','shape','block'].includes(b.type)))) throw Error("The saved document is corrupted. Its original record has been preserved.");
  if (!Number.isInteger(doc.revision) || doc.revision < 0) throw Error("Invalid saved revision.");
  return doc;
}
export function copyDocument(source, { workspace, job, kind = "estimate", name = source.name }) {
  const doc = structuredClone(source);
  return { ...doc, id: uid(), workspace, job, kind, name, revision: 0, sourceTemplateId: source.kind === 'template' ? source.id : null,
    pages: doc.pages.map(p => ({ ...p, id: uid(), blocks: p.blocks.map(b => ({ ...b, id: uid() })) })) };
}
export function openBuilderDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("documents", { keyPath: "id" }); request.result.createObjectStore("revisions", { keyPath: "key" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Storage is busy in another tab. Close its storage inspector and Retry."));
  });
}
export async function loadDocument(id, workspace, job) {
  return documentLock(`${workspace}/${job}/${id}`, async () => {
    const db = await openBuilderDatabase();
    try {
      const row = await new Promise((resolve,reject) => { const r=db.transaction('documents').objectStore('documents').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); });
      if (!row) throw Error("Saved document not found. Start blank or recover a local draft; no existing record was replaced.");
      return validateDocument(row, workspace, job);
    } finally { db.close(); }
  });
}
export async function saveDocument(document, expectedRevision = document.revision) {
  const next = structuredClone(validateDocument(document, document.workspace, document.job));
  return documentLock(`${next.workspace}/${next.job}/${next.id}`, async () => {
    const db = await openBuilderDatabase();
    try {
      await new Promise((resolve,reject) => {
        const tx=db.transaction(['documents','revisions'],'readwrite');const docs=tx.objectStore('documents');let failure;
        tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(failure || tx.error || Error('Save transaction interrupted. Previous revision remains intact.'));
        const request=docs.get(next.id);
        request.onsuccess=()=>{try {
          const current=request.result;
          if(current) validateDocument(current,next.workspace,next.job);
          if((current?.revision || 0)!==expectedRevision) throw Error('Another tab saved a newer revision. Reload it or save your changes as a separate copy.');
          if(current) tx.objectStore('revisions').add({key:`${current.id}/${current.revision}`,document:current});
          next.revision=expectedRevision+1;next.updatedAt=new Date().toISOString();docs.put(next);
        }catch(e){failure=e;tx.abort();}};
      });
      return next;
    } finally { db.close(); }
  });
}
export async function listDocuments(workspace) {
  const db=await openBuilderDatabase();
  try { return await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').getAll();r.onsuccess=()=>resolve(r.result.filter(d=>d.workspace===workspace));r.onerror=()=>reject(r.error);}); }
  finally { db.close(); }
}
