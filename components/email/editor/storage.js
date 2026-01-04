// /components/email/editor/storage.js
// FULL REPLACEMENT — reusable blocks + default signature storage (localStorage)

export const LS_BLOCKS_KEY = "gr8:email:reusableBlocks:v1";
export const LS_DEFAULT_SIGNATURE_KEY = "gr8:email:defaultSignatureId:v1";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadBlocks() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LS_BLOCKS_KEY);
  const arr = safeParse(raw || "[]", []);
  return Array.isArray(arr) ? arr : [];
}

export function saveBlocks(blocks) {
  if (typeof window === "undefined") return;
  const arr = Array.isArray(blocks) ? blocks : [];
  window.localStorage.setItem(LS_BLOCKS_KEY, JSON.stringify(arr));
}

export function getDefaultSignatureId() {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem(LS_DEFAULT_SIGNATURE_KEY) || "");
}

export function setDefaultSignatureId(id) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_DEFAULT_SIGNATURE_KEY, String(id || ""));
}

export function clearDefaultSignature() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LS_DEFAULT_SIGNATURE_KEY);
}

export function uid(prefix = "blk") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
