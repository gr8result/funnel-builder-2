// Takeoff Engine V2 persistence.
//
// Deliberately different shape from the legacy engine's single `gr8:takeoff:v1`
// blob: each record type has its own key and its own explicit save boundary, so
// saving a rotation change can never clobber an unrelated in-flight edit, and a
// delete can never leave orphaned data behind under a still-live key.
//
// Namespaced separately from the legacy key so V2 can be developed and torn down
// without ever touching legacy state.

const DOCUMENTS_KEY = (jobId) => `gr8:takeoff-v2:documents:${jobId || "unassigned"}`;
const PAGES_KEY = (documentId) => `gr8:takeoff-v2:pages:${documentId}`;
const SELECTED_PAGE_KEY = (jobId) => `gr8:takeoff-v2:selectedPage:${jobId || "unassigned"}`;

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

// ---------- documents ----------

export function listDocuments(jobId) {
  return readJson(DOCUMENTS_KEY(jobId), []);
}

export function saveDocument(document) {
  const documents = listDocuments(document.jobId);
  const next = documents.filter((doc) => doc.id !== document.id);
  next.push(document);
  writeJson(DOCUMENTS_KEY(document.jobId), next);
  return document;
}

export function getDocument(jobId, documentId) {
  return listDocuments(jobId).find((doc) => doc.id === documentId) || null;
}

export function deleteDocument(jobId, documentId) {
  const documents = listDocuments(jobId).filter((doc) => doc.id !== documentId);
  writeJson(DOCUMENTS_KEY(jobId), documents);
  removeKey(PAGES_KEY(documentId));

  const selectedPageId = getSelectedPageId(jobId);
  if (selectedPageId) {
    const remainingPages = documents.flatMap((doc) => listPages(doc.id));
    if (!remainingPages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(jobId, remainingPages[0]?.id || null);
    }
  }
}

// ---------- pages ----------

export function listPages(documentId) {
  return readJson(PAGES_KEY(documentId), []);
}

export function savePage(page) {
  const pages = listPages(page.documentId);
  const next = pages.filter((existing) => existing.id !== page.id);
  next.push({ ...page, updatedAt: new Date().toISOString() });
  next.sort((a, b) => a.pageNumber - b.pageNumber);
  writeJson(PAGES_KEY(page.documentId), next);
  return next.find((existing) => existing.id === page.id);
}

export function getPage(documentId, pageId) {
  return listPages(documentId).find((page) => page.id === pageId) || null;
}

export function savePages(documentId, pages) {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  writeJson(PAGES_KEY(documentId), sorted);
  return sorted;
}

// ---------- selected page (per job) ----------

export function getSelectedPageId(jobId) {
  return readJson(SELECTED_PAGE_KEY(jobId), null);
}

export function setSelectedPageId(jobId, pageId) {
  writeJson(SELECTED_PAGE_KEY(jobId), pageId || null);
}

// ---------- aggregate read for the workspace ----------

export function listAllPages(jobId) {
  return listDocuments(jobId).flatMap((doc) => listPages(doc.id));
}
