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

const compareKeys = (a, b) => indexKey(a) ? (indexKey(b) ? Number(a) - Number(b) : -1) : indexKey(b) ? 1 : a < b ? -1 : a > b ? 1 : 0;
const keptKey = (value, key, root, excludeMetadata) => value[key] !== undefined && !['function', 'symbol'].includes(typeof value[key]) && !(root && excludeMetadata && METADATA.has(key));
const FLAT_STRING_MAX = 4096;
const flatShapes = new Map();

// A non-root value that serialises without recursion: a primitive, a short string, or a plain object whose
// values are all primitives or short strings (a point, a PDF line segment, a small record). Returns exactly
// the text the generator below would produce, or null when the value needs the general path. Large plans
// hold millions of these; one generator step per number made a 19-page vector job take minutes to save.
function flatJson(value) {
  if (value === null || value === undefined) return 'null';
  const type = typeof value;
  if (type === 'string') return value.length <= FLAT_STRING_MAX ? JSON.stringify(value) : null;
  if (type === 'number' || type === 'boolean') return JSON.stringify(value);
  if (type === 'function' || type === 'symbol') return 'null';
  if (type !== 'object' || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const keys = Object.keys(value);
  let omitted = false;
  for (const key of keys) {
    const item = value[key], itemType = typeof item;
    if (item !== null && itemType === 'object') return null;
    if (itemType === 'string' && item.length > FLAT_STRING_MAX) return null;
    if (itemType === 'bigint') return null;
    if (item === undefined || itemType === 'function' || itemType === 'symbol') omitted = true;
  }
  // Objects of one shape (every segment of a sheet) share their sorted key order and key text.
  let shape;
  if (!omitted && keys.length <= 32) {
    const signature = keys.join('\u0000');
    shape = flatShapes.get(signature);
    if (!shape) {
      const order = [...keys].sort(compareKeys);
      shape = { order, prefixes: order.map((key, i) => (i ? ',' : '') + JSON.stringify(key) + ':') };
      if (flatShapes.size > 4096) flatShapes.clear();
      flatShapes.set(signature, shape);
    }
  } else {
    const order = keys.filter(key => keptKey(value, key, false, false)).sort(compareKeys);
    shape = { order, prefixes: order.map((key, i) => (i ? ',' : '') + JSON.stringify(key) + ':') };
  }
  let text = '{';
  for (let i = 0; i < shape.order.length; i++) {
    const item = value[shape.order[i]];
    // Same text as JSON.stringify: finite numbers print as String(n) (-0 as "0"), others as null.
    text += shape.prefixes[i] + (typeof item === 'number' ? (Number.isFinite(item) ? String(item) : 'null')
      : item === true ? 'true' : item === false ? 'false' : item === null ? 'null' : JSON.stringify(item));
    if (text.length > 2 * CHUNK) return null; // keep every chunk bounded; the general path streams it
  }
  return text + '}';
}

export function* jobJsonChunks(value, excludeMetadata = true, root = true) {
  if (typeof value === 'string') { yield* stringChunks(value); return; }
  if (Array.isArray(value)) {
    let pending = '[';
    for (let i = 0; i < value.length; i++) {
      if (i) pending += ',';
      const flat = flatJson(value[i] ?? null);
      if (flat !== null) { pending += flat; if (pending.length >= CHUNK) { yield pending; pending = ''; } continue; }
      if (pending) { yield pending; pending = ''; }
      yield* jobJsonChunks(value[i] ?? null, excludeMetadata, false);
    }
    yield pending + ']';
  } else if (value && typeof value === 'object') {
    // JSON enumerates integer keys numerically, including on the legacy sorted object.
    const keys = Object.keys(value).filter(key => keptKey(value, key, root, excludeMetadata)).sort(compareKeys);
    let pending = '{';
    for (let i = 0; i < keys.length; i++) {
      if (i) pending += ',';
      if (keys[i].length > FLAT_STRING_MAX) { if (pending) { yield pending; pending = ''; } yield* stringChunks(keys[i]); pending = ':'; }
      else pending += JSON.stringify(keys[i]) + ':';
      const flat = flatJson(value[keys[i]]);
      if (flat !== null) { pending += flat; if (pending.length >= CHUNK) { yield pending; pending = ''; } continue; }
      if (pending) { yield pending; pending = ''; }
      yield* jobJsonChunks(value[keys[i]], excludeMetadata, false);
    }
    yield pending + '}';
  } else yield JSON.stringify(value) ?? 'null';
}

export async function jobChecksum(workbook) {
  // The browser's own SHA-256 gives the same digest for the same bytes many times faster than the
  // JavaScript one (about 11 s of a 60 s large-plan save). It needs a secure context; elsewhere (and
  // if it fails) the JavaScript hash below is used. Either way the stored checksum is identical.
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const parts = [];
      let total = 0, budget = 0;
      for (const bytes of encodedJobChunks(workbook)) {
        parts.push(bytes); total += bytes.length; budget += bytes.length;
        if (budget >= 8 * 1024 * 1024) { budget = 0; await new Promise(resolve => setTimeout(resolve, 0)); }
      }
      const all = new Uint8Array(total);
      let at = 0;
      for (let i = 0; i < parts.length; i++) { all.set(parts[i], at); at += parts[i].length; parts[i] = null; }
      const digest = new Uint8Array(await subtle.digest('SHA-256', all));
      return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      // fall through to the streaming JavaScript hash
    }
  }
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
