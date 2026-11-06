// Content ids of the large images (plan pages, proposal artwork) this session has stored in, or read
// from, the browser's asset store. Keyed by the image string itself (the one the open job already
// holds), so a lookup is exact: equal text, equal id. Bounded by total characters.
const known = new Map();
const CHAR_LIMIT = 200 * 1024 * 1024;
let chars = 0;

export function rememberAssetId(text, id, byteLength) {
  if (typeof text !== "string" || !id || known.has(text)) return;
  known.set(text, { id, byteLength });
  chars += text.length;
  for (const [key] of known) {
    if (chars <= CHAR_LIMIT) break;
    known.delete(key);
    chars -= key.length;
  }
}

export function knownAsset(text) {
  return typeof text === "string" ? known.get(text) || null : null;
}
