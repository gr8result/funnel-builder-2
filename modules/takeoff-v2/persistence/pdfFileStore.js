const DB_NAME = "gr8-takeoff-v2-files";
const DB_VERSION = 1;
const STORE_NAME = "pdfFiles";

function assertBrowserStorage() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("PDF file storage is only available in the browser.");
  }
}

function openDb() {
  assertBrowserStorage();
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open PDF file store."));
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let settled = false;
      const finish = (value) => {
        settled = true;
        resolve(value);
      };
      tx.onerror = () => reject(tx.error || new Error("PDF file store transaction failed."));
      tx.onabort = () => reject(tx.error || new Error("PDF file store transaction aborted."));
      tx.oncomplete = () => {
        if (!settled) resolve(undefined);
      };
      callback(store, finish, reject);
    });
  } finally {
    db.close();
  }
}

export async function savePdfFile(documentId, file) {
  const blob = file instanceof Blob ? file : new Blob([file], { type: "application/pdf" });
  const record = {
    id: documentId,
    blob,
    fileName: file.name || "plan.pdf",
    mimeType: file.type || "application/pdf",
    size: file.size || blob.size,
    updatedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store, finish, reject) => {
    const request = store.put(record);
    request.onsuccess = () => finish(record);
    request.onerror = () => reject(request.error || new Error("Could not save PDF file."));
  });

  return {
    fileStorageKey: documentId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.size,
  };
}

export async function getPdfFile(documentId) {
  if (!documentId) return null;
  return withStore("readonly", (store, finish, reject) => {
    const request = store.get(documentId);
    request.onsuccess = () => finish(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not read PDF file."));
  });
}

export async function getPdfFileBlob(planDocument) {
  const record = await getPdfFile(planDocument?.fileStorageKey || planDocument?.id);
  return record?.blob || null;
}

export async function deletePdfFile(documentId) {
  if (!documentId || typeof window === "undefined" || !window.indexedDB) return;
  await withStore("readwrite", (store, finish, reject) => {
    const request = store.delete(documentId);
    request.onsuccess = () => finish();
    request.onerror = () => reject(request.error || new Error("Could not delete PDF file."));
  });
}
