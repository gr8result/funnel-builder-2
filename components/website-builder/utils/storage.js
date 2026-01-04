// /components/website-builder/utils/storage.js
// FULL REPLACEMENT

const LS_KEY = "gr8:website-builder:site:v1";

export function loadSiteFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function saveSiteToStorage(site) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...site, updatedAt: new Date().toISOString() };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch (e) {
    // ignore
  }
}
