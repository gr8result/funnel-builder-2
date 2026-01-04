// /components/email/editor/reusableBlocks.js
// FULL REPLACEMENT — save any selection as reusable (signature/header/footer/etc) + set default

export const LS_BLOCKS_KEY = "gr8:email:reusableBlocks:v1";
export const LS_DEFAULT_BLOCK_KEY = "gr8:email:defaultReusableBlock:v1";

function uid() {
  return `blk_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export function loadReusableBlocks() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_BLOCKS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveReusableBlock({ name, html }) {
  if (typeof window === "undefined") return null;
  const list = loadReusableBlocks();

  const item = {
    id: uid(),
    name: String(name || "Block").trim() || "Block",
    html: String(html || ""),
    updatedAt: new Date().toISOString(),
  };

  const next = [item, ...list].slice(0, 50);
  window.localStorage.setItem(LS_BLOCKS_KEY, JSON.stringify(next));
  return item;
}

export function setDefaultBlockId(id) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_DEFAULT_BLOCK_KEY, String(id || ""));
}

export function getDefaultBlockId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(LS_DEFAULT_BLOCK_KEY) || "");
  } catch {
    return "";
  }
}
