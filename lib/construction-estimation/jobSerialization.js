import { sha256 } from '@noble/hashes/sha256';

const METADATA = new Set(['savedAt', 'lastSavedAt', 'page']);
const CHUNK = 16 * 1024;
const encoder = new TextEncoder();

// Strings are immutable. structuredClone copies large data-URL strings as well
// as the editable containers; sharing their values avoids another image-sized
// allocation while still capturing every mutable object before an async save.
export function snapshotJob(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return structuredClone(value);
  const copy = Array.isArray(value) ? new Array(value.length) : {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) Object.defineProperty(copy, key, { value: snapshotJob(value[key], seen), writable: true, enumerable: true, configurable: true });
  return copy;
}

// Emit exactly the legacy sorted JSON representation without building a second
// workbook, a whole-job JSON string and a whole-job UTF-8 buffer at once.
function* stringChunks(value) {
  yield '"';
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + CHUNK, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
    yield JSON.stringify(value.slice(start, end)).slice(1, -1);
    start = end;
  }
  yield '"';
}

function indexKey(key) {
  const n = Number(key);
  return Number.isInteger(n) && n >= 0 && n < 4294967295 && String(n) === key;
}

export function* jobJsonChunks(value, excludeMetadata = true, root = true) {
  if (typeof value === 'string') { yield* stringChunks(value); return; }
  if (Array.isArray(value)) {
    yield '[';
    for (let i = 0; i < value.length; i++) {
      if (i) yield ',';
      yield* jobJsonChunks(value[i] ?? null, excludeMetadata, false);
    }
    yield ']';
  } else if (value && typeof value === 'object') {
    yield '{';
    // JSON enumerates integer keys numerically, including on the legacy sorted object.
    const keys = Object.keys(value).filter(key => value[key] !== undefined && !['function', 'symbol'].includes(typeof value[key]) && !(root && excludeMetadata && METADATA.has(key)))
      .sort((a, b) => indexKey(a) ? (indexKey(b) ? Number(a) - Number(b) : -1) : indexKey(b) ? 1 : a < b ? -1 : a > b ? 1 : 0);
    for (let i = 0; i < keys.length; i++) {
      if (i) yield ',';
      yield* stringChunks(keys[i]); yield ':';
      yield* jobJsonChunks(value[keys[i]], excludeMetadata, false);
    }
    yield '}';
  } else yield JSON.stringify(value) ?? 'null';
}

export async function jobChecksum(workbook) {
  const hash = sha256.create();
  let budget = 0;
  try {
    for (const bytes of encodedJobChunks(workbook)) {
      hash.update(bytes);
      budget += bytes.length;
      // Yield during large saves so navigation and newer edits remain responsive.
      if (budget >= 4 * 1024 * 1024) {
        budget = 0;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return Array.from(hash.digest(), byte => byte.toString(16).padStart(2, '0')).join('');
  } finally { hash.destroy(); }
}

export function jobJsonByteLength(workbook) {
  let size = 0;
  for (const bytes of encodedJobChunks(workbook, false)) size += bytes.length;
  return size;
}

// Hashing each punctuation/key token creates millions of short typed arrays.
// Batch tokens into a bounded buffer before encoding or updating SHA-256.
function* encodedJobChunks(workbook, excludeMetadata = true) {
  let buffer = '';
  for (const chunk of jobJsonChunks(workbook, excludeMetadata)) {
    buffer += chunk;
    if (buffer.length >= 64 * 1024) { yield encoder.encode(buffer); buffer = ''; }
  }
  if (buffer) yield encoder.encode(buffer);
}
