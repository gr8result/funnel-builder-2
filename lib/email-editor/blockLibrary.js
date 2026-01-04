// ============================================
// /pages/modules/email/editor/blockLibrary.js
// FULL REPLACEMENT
// Local reusable block library (headers/footers/etc)
// ============================================

export const LS_BLOCKS_KEY = "gr8:email:reusableBlocks:v1";

export function loadSavedBlocks() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_BLOCKS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function persistBlocks(blocks) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_BLOCKS_KEY, JSON.stringify(blocks || []));
  } catch {}
}

export function saveBlockToLibrary(existing, { name, block }) {
  const safeName = String(name || "").trim();
  if (!safeName) return existing;

  const payload = {
    id: Date.now(),
    name: safeName,
    block: JSON.parse(JSON.stringify(block)),
    createdAt: Date.now(),
  };

  const idx = (existing || []).findIndex(
    (b) => String(b.name || "").toLowerCase() === safeName.toLowerCase()
  );

  const next =
    idx >= 0
      ? existing.map((b, i) => (i === idx ? { ...payload, id: b.id } : b))
      : [...(existing || []), payload];

  persistBlocks(next);
  return next;
}

export function deleteBlockFromLibrary(existing, id) {
  const next = (existing || []).filter((b) => b.id !== id);
  persistBlocks(next);
  return next;
}
