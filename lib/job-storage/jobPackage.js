// A job as it is STORED: a small core record plus separately stored assets.
//
// A job workbook carries plans, images and page-builder documents inline as very long strings
// (88 MB of the 100 MB "New Job 03/09" is three page-builder documents). Stored that way, every
// save, revision and read moves all of it. splitJob() lifts every long string out into a
// content-addressed asset (its SHA-256) and leaves a reference in its place; joinJob() puts them
// back. The round trip is exact, so .gr8job import / export and every module see the same workbook.
//
// An asset is immutable and named by its content: saving a job whose plans did not change uploads
// nothing but the core record, and two revisions that share a document share one stored copy.
// Runs in the browser and in Node (Web Crypto).

export const ASSET_REFERENCE_KEY = "$gr8asset";
export const ASSET_MIN_CHARS = 32 * 1024;
export const JOB_PACKAGE_VERSION = 1;

const encoder = new TextEncoder();
export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const isAssetReference = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof value[ASSET_REFERENCE_KEY] === "string";

// { core, assets: Map<hash, string>, stats }. `core` is plain JSON with references where the long
// strings were. The same string met twice is stored once.
export async function splitJob(workbook, { minChars = ASSET_MIN_CHARS } = {}) {
  const assets = new Map();
  const seen = new Map(); // string instance / content -> reference, so a repeated document is hashed once
  let assetChars = 0;
  const walk = async (value) => {
    if (typeof value === "string") {
      if (value.length < minChars) return value;
      let reference = seen.get(value);
      if (!reference) {
        const hash = await sha256Hex(value);
        reference = { [ASSET_REFERENCE_KEY]: hash, chars: value.length };
        seen.set(value, reference);
        if (!assets.has(hash)) { assets.set(hash, value); assetChars += value.length; }
      }
      return { ...reference };
    }
    if (Array.isArray(value)) { const out = new Array(value.length); for (let index = 0; index < value.length; index++) out[index] = await walk(value[index]); return out; }
    if (value && typeof value === "object") {
      if (isAssetReference(value)) throw new Error(`A job may not contain the reserved key "${ASSET_REFERENCE_KEY}".`);
      const out = {};
      for (const key of Object.keys(value)) { const item = value[key]; if (item !== undefined) out[key] = await walk(item); }
      return out;
    }
    return value;
  };
  const core = await walk(workbook);
  return { core, assets, stats: { assets: assets.size, assetChars } };
}

// Every asset hash a core record refers to.
export function assetHashesOf(core) {
  const hashes = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    if (isAssetReference(value)) { hashes.add(value[ASSET_REFERENCE_KEY]); return; }
    for (const key of Object.keys(value)) walk(value[key]);
  };
  walk(core);
  return [...hashes];
}

// The workbook a core record stands for. getAsset(hash) -> string (may be async). Each asset is
// fetched once however many times it is referenced, and is checked against its hash when
// `verify` is set, so a damaged or substituted document is never loaded as if it were genuine.
export async function joinJob(core, getAsset, { verify = false } = {}) {
  const loaded = new Map();
  for (const hash of assetHashesOf(core)) {
    const text = await getAsset(hash);
    if (typeof text !== "string") throw new Error(`Job asset ${hash} is missing from storage.`);
    if (verify && await sha256Hex(text) !== hash) throw new Error(`Job asset ${hash} does not match its content hash.`);
    loaded.set(hash, text);
  }
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    if (isAssetReference(value)) return loaded.get(value[ASSET_REFERENCE_KEY]);
    const out = {};
    for (const key of Object.keys(value)) out[key] = walk(value[key]);
    return out;
  };
  return walk(core);
}
