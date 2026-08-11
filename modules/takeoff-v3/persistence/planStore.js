import { withPlanPageDefaults } from "../core/types.js";

const DOCUMENTS_KEY = (jobId) => `gr8:takeoff-v3:documents:${jobId || "unassigned"}`;
const PAGES_KEY = (documentId) => `gr8:takeoff-v3:pages:${documentId}`;
const SELECTED_PAGE_KEY = (jobId) => `gr8:takeoff-v3:selectedPage:${jobId || "unassigned"}`;

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

function sanitizeDocument(document) {
  const safe = { ...(document || {}) };
  delete safe.originalFileUrl;
  delete safe.sourceUrl;
  delete safe.rasterImage;
  delete safe.thumbnailDataUrl;
  return { ...safe, fileStorageKey: safe.fileStorageKey || safe.id };
}

function sanitizePage(page) {
  const safe = { ...(page || {}) };
  delete safe.sourceUrl;
  delete safe.rasterImage;
  delete safe.thumbnailDataUrl;
  return safe;
}

export function listDocuments(jobId) {
  return readJson(DOCUMENTS_KEY(jobId), []).map(sanitizeDocument);
}

export function saveDocument(document) {
  const documents = listDocuments(document.jobId).filter((doc) => doc.id !== document.id);
  documents.push(sanitizeDocument(document));
  writeJson(DOCUMENTS_KEY(document.jobId), documents);
  return sanitizeDocument(document);
}

export function deleteDocument(jobId, documentId) {
  writeJson(DOCUMENTS_KEY(jobId), listDocuments(jobId).filter((doc) => doc.id !== documentId));
  if (typeof window !== "undefined") window.localStorage.removeItem(PAGES_KEY(documentId));
}

export function listPages(documentId) {
  return readJson(PAGES_KEY(documentId), []).map(sanitizePage).map(withPlanPageDefaults);
}

export function savePages(documentId, pages) {
  const next = pages.map(sanitizePage).map(withPlanPageDefaults).sort((a, b) => a.pageNumber - b.pageNumber);
  writeJson(PAGES_KEY(documentId), next);
  return next;
}

export function savePage(page) {
  const next = listPages(page.documentId).filter((candidate) => candidate.id !== page.id);
  next.push(withPlanPageDefaults(sanitizePage({ ...page, updatedAt: new Date().toISOString() })));
  next.sort((a, b) => a.pageNumber - b.pageNumber);
  writeJson(PAGES_KEY(page.documentId), next);
  return next.find((candidate) => candidate.id === page.id);
}

export function getSelectedPageId(jobId) {
  return readJson(SELECTED_PAGE_KEY(jobId), null);
}

export function setSelectedPageId(jobId, pageId) {
  writeJson(SELECTED_PAGE_KEY(jobId), pageId || null);
}
