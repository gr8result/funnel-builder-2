// Takeoff Engine V2 persistence.
//
// Deliberately different shape from the legacy engine's single `gr8:takeoff:v1`
// blob: each record type has its own key and its own explicit save boundary, so
// saving a rotation change can never clobber an unrelated in-flight edit, and a
// delete can never leave orphaned data behind under a still-live key.
//
// Namespaced separately from the legacy key so V2 can be developed and torn down
// without ever touching legacy state.

import { withPlanPageDefaults } from "../types.js";

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

// Known constraint of this store's design (localStorage, whole PDFs as
// base64 data URLs): a browser's per-origin quota (typically 5-10MB) can be
// exceeded by a handful of plan uploads, especially across repeated test
// sessions that never delete old documents. Surfacing a clear, actionable
// message here (instead of the raw DOMException text) is a proportionate
// fix for that failure mode; moving plan bytes to real backend storage is a
// separate, larger architectural change, not done here.
function isQuotaExceededError(err) {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new Error("This browser's local storage is full. Delete an existing plan document to free up space, then try again.");
    }
    throw err;
  }
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

// Every read of a saved page runs it through withPlanPageDefaults — a page
// saved before a given field existed (exteriorWalls, openings, planRegion,
// ...) gets safe defaults instead of undefined, and a corrupted single
// section never blocks the rest of the page from loading. Applied on every
// read path (listPages/getPage) rather than once at write time, so it also
// repairs records written by an older build of this module.
export function listPages(documentId) {
  return readJson(PAGES_KEY(documentId), []).map(withPlanPageDefaults);
}

export function savePage(page) {
  const pages = readJson(PAGES_KEY(page.documentId), []);
  const next = pages.filter((existing) => existing.id !== page.id);
  next.push({ ...page, updatedAt: new Date().toISOString() });
  next.sort((a, b) => a.pageNumber - b.pageNumber);
  writeJson(PAGES_KEY(page.documentId), next);
  return withPlanPageDefaults(next.find((existing) => existing.id === page.id));
}

export function getPage(documentId, pageId) {
  return listPages(documentId).find((page) => page.id === pageId) || null;
}

export function savePages(documentId, pages) {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  writeJson(PAGES_KEY(documentId), sorted);
  return sorted.map(withPlanPageDefaults);
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
