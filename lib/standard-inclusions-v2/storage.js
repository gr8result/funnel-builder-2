import {
  checksumStandardInclusionsV2Document,
  normaliseStandardInclusionsV2Document,
} from "./schema.js";

const DB_NAME = "standard-inclusions-v2";
const DB_VERSION = 1;
const DOC_STORE = "documents";
const REVISION_STORE = "revisions";
const NAV_STORE = "navigation";
const DELETE_STORE = "deletions";

export const STALE_STANDARD_INCLUSIONS_V2_SAVE = "STALE_STANDARD_INCLUSIONS_V2_SAVE";

export function createMemoryStandardInclusionsV2Adapter() {
  const stores = {
    [DOC_STORE]: new Map(),
    [REVISION_STORE]: new Map(),
    [NAV_STORE]: new Map(),
    [DELETE_STORE]: new Map(),
  };
  return {
    async get(store, key) {
      return clone(stores[store]?.get(key) || null);
    },
    async put(store, value, key = value?.id) {
      stores[store].set(key, clone(value));
      return clone(value);
    },
    async delete(store, key) {
      stores[store].delete(key);
    },
    async values(store) {
      return Array.from(stores[store]?.values() || []).map(clone);
    },
  };
}

export function createIndexedDbStandardInclusionsV2Adapter() {
  return {
    async get(store, key) {
      const db = await openDb();
      return runStoreRequest(db, store, "readonly", (objectStore) => objectStore.get(key));
    },
    async put(store, value, key = value?.id) {
      const db = await openDb();
      await runStoreRequest(db, store, "readwrite", (objectStore) => objectStore.put(value, key));
      return value;
    },
    async delete(store, key) {
      const db = await openDb();
      await runStoreRequest(db, store, "readwrite", (objectStore) => objectStore.delete(key));
    },
    async values(store) {
      const db = await openDb();
      return runStoreRequest(db, store, "readonly", (objectStore) => objectStore.getAll());
    },
  };
}

export function createStandardInclusionsV2Store(adapter = null) {
  const db = adapter || createIndexedDbStandardInclusionsV2Adapter();

  async function listDocuments({ tenantId, ownerUserId } = {}) {
    const safeTenant = String(tenantId || "");
    const safeOwner = String(ownerUserId || "");
    return (await db.values(DOC_STORE))
      .map(normaliseStandardInclusionsV2Document)
      .filter((document) => document.tenantId === safeTenant && document.ownerUserId === safeOwner)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  async function loadDocument({ tenantId, ownerUserId, documentId } = {}) {
    if (!documentId) return null;
    const document = await db.get(DOC_STORE, documentId);
    const normalized = document ? normaliseStandardInclusionsV2Document(document) : null;
    if (!normalized) return null;
    assertDocumentAccess(normalized, tenantId, ownerUserId);
    return normalized;
  }

  async function loadActiveDocument({ tenantId, ownerUserId } = {}) {
    const navigation = await loadNavigation({ tenantId, ownerUserId });
    if (!navigation?.documentId) return null;
    return loadDocument({ tenantId, ownerUserId, documentId: navigation.documentId });
  }

  async function saveDocument(document, { tenantId, ownerUserId, baseUpdatedAt = "", baseRevisionId = "", trigger = "manual-save", createRevision = true } = {}) {
    const normalized = normaliseStandardInclusionsV2Document(document);
    assertDocumentAccess(normalized, tenantId, ownerUserId);
    const existing = await db.get(DOC_STORE, normalized.id);
    if (existing) {
      assertDocumentAccess(existing, tenantId, ownerUserId);
      if (baseUpdatedAt && existing.updatedAt && baseUpdatedAt !== existing.updatedAt) {
        throw staleSaveError("Document has changed since it was opened.", existing);
      }
      if (baseRevisionId && existing.activeRevisionId && baseRevisionId !== existing.activeRevisionId) {
        throw staleSaveError("Document revision has changed since it was opened.", existing);
      }
    }
    if (existing && existing.pages?.length && !normalized.pages.length) {
      throw new Error("Refusing to save an empty Standard Inclusions document over a non-empty document.");
    }
    const revision = createRevision
      ? await writeRevision(existing || normalized, { tenantId, ownerUserId, trigger })
      : null;
    const now = new Date().toISOString();
    const saved = {
      ...normalized,
      updatedAt: now,
      activeRevisionId: revision?.id || normalized.activeRevisionId || "",
      sourceChecksum: checksumStandardInclusionsV2Document(normalized),
    };
    await db.put(DOC_STORE, saved, saved.id);
    const readBack = await db.get(DOC_STORE, saved.id);
    const readBackDocument = readBack ? normaliseStandardInclusionsV2Document(readBack) : null;
    if (!readBackDocument || readBackDocument.id !== saved.id || readBackDocument.pages.length !== saved.pages.length) {
      throw new Error("Standard Inclusions save verification failed.");
    }
    return readBackDocument;
  }

  async function deleteDocument({ tenantId, ownerUserId, documentId } = {}) {
    const document = await loadDocument({ tenantId, ownerUserId, documentId });
    if (!document) return null;
    await writeRevision(document, { tenantId, ownerUserId, trigger: "delete" });
    await db.delete(DOC_STORE, document.id);
    await db.put(DELETE_STORE, {
      id: deletionKey(tenantId, ownerUserId),
      tenantId,
      ownerUserId,
      documentId: document.id,
      deletedAt: new Date().toISOString(),
    }, deletionKey(tenantId, ownerUserId));
    await saveNavigation({ tenantId, ownerUserId, documentId: "", selectedPageId: "", zoom: 1 });
    return document;
  }

  async function loadNavigation({ tenantId, ownerUserId } = {}) {
    return await db.get(NAV_STORE, navigationKey(tenantId, ownerUserId)) || {
      tenantId,
      ownerUserId,
      documentId: "",
      selectedPageId: "",
      zoom: 1,
      updatedAt: "",
    };
  }

  async function saveNavigation({ tenantId, ownerUserId, documentId = "", selectedPageId = "", zoom = 1 } = {}) {
    const navigation = {
      id: navigationKey(tenantId, ownerUserId),
      tenantId,
      ownerUserId,
      documentId,
      selectedPageId,
      zoom,
      updatedAt: new Date().toISOString(),
    };
    await db.put(NAV_STORE, navigation, navigation.id);
    return navigation;
  }

  async function listRevisions({ tenantId, ownerUserId, documentId } = {}) {
    return (await db.values(REVISION_STORE))
      .filter((revision) => revision?.tenantId === tenantId && revision?.ownerUserId === ownerUserId && revision?.documentId === documentId)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  async function writeRevision(document, { tenantId, ownerUserId, trigger = "revision" } = {}) {
    const normalized = normaliseStandardInclusionsV2Document(document);
    const revision = {
      id: `revision-${normalized.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      ownerUserId,
      documentId: normalized.id,
      trigger,
      pageCount: normalized.pages.length,
      checksum: checksumStandardInclusionsV2Document(normalized),
      createdAt: new Date().toISOString(),
      snapshot: normalized,
    };
    await db.put(REVISION_STORE, revision, revision.id);
    return revision;
  }

  return {
    listDocuments,
    loadDocument,
    loadActiveDocument,
    saveDocument,
    deleteDocument,
    loadNavigation,
    saveNavigation,
    listRevisions,
  };
}

function assertDocumentAccess(document, tenantId, ownerUserId) {
  if (String(document?.tenantId || "") !== String(tenantId || "")) {
    throw new Error("Standard Inclusions document tenant mismatch.");
  }
  if (String(document?.ownerUserId || "") !== String(ownerUserId || "")) {
    throw new Error("Standard Inclusions document owner mismatch.");
  }
}

function staleSaveError(message, currentDocument) {
  const error = new Error(message);
  error.code = STALE_STANDARD_INCLUSIONS_V2_SAVE;
  error.currentDocument = currentDocument;
  return error;
}

function navigationKey(tenantId, ownerUserId) {
  return `${tenantId || "tenant"}::${ownerUserId || "user"}::navigation`;
}

function deletionKey(tenantId, ownerUserId) {
  return `${tenantId || "tenant"}::${ownerUserId || "user"}::deleted`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available for Standard Inclusions V2."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      [DOC_STORE, REVISION_STORE, NAV_STORE, DELETE_STORE].forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Standard Inclusions V2 storage."));
  });
}

function runStoreRequest(db, store, mode, makeRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = makeRequest(transaction.objectStore(store));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Standard Inclusions V2 storage request failed."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Standard Inclusions V2 storage transaction failed."));
    };
  });
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
