// The job serializer's flat-leaf fast path must emit exactly the text of the original generator (saved
// checksums depend on it) while saving large vector plan sets in seconds, not minutes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { jobChecksum, jobJsonChunks, jobJsonByteLength } from '../lib/construction-estimation/jobSerialization.js';
import { jobContentSignature } from '../lib/construction-estimation/jobPersistence.js';

// ---- The original generator, verbatim, as the reference ----
const METADATA = new Set(['savedAt', 'lastSavedAt', 'page']);
const CHUNK = 16 * 1024;
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
function indexKey(key) { const n = Number(key); return Number.isInteger(n) && n >= 0 && n < 4294967295 && String(n) === key; }
function* reference(value, excludeMetadata = true, root = true) {
  if (typeof value === 'string') { yield* stringChunks(value); return; }
  if (Array.isArray(value)) {
    yield '[';
    for (let i = 0; i < value.length; i++) { if (i) yield ','; yield* reference(value[i] ?? null, excludeMetadata, false); }
    yield ']';
  } else if (value && typeof value === 'object') {
    yield '{';
    const keys = Object.keys(value).filter(key => value[key] !== undefined && !['function', 'symbol'].includes(typeof value[key]) && !(root && excludeMetadata && METADATA.has(key)))
      .sort((a, b) => indexKey(a) ? (indexKey(b) ? Number(a) - Number(b) : -1) : indexKey(b) ? 1 : a < b ? -1 : a > b ? 1 : 0);
    for (let i = 0; i < keys.length; i++) { if (i) yield ','; yield* stringChunks(keys[i]); yield ':'; yield* reference(value[keys[i]], excludeMetadata, false); }
    yield '}';
  } else yield JSON.stringify(value) ?? 'null';
}
const same = (value, label) => {
  for (const exclude of [true, false]) {
    const expected = [...reference(value, exclude)].join('');
    const chunks = [...jobJsonChunks(value, exclude)];
    assert.equal(chunks.join(''), expected, `${label} (excludeMetadata=${exclude})`);
    assert.ok(Math.max(0, ...chunks.map((chunk) => chunk.length)) < 100_000, `${label}: chunks stay bounded`);
  }
};

// ---- Edge cases ----
class Custom { constructor() { this.b = 2; this.a = 1; } }
const fn = () => 1;
same({ savedAt: 'x', page: 3, lastSavedAt: 'y', nested: { savedAt: 'kept', page: 1 }, list: [{ page: 2, savedAt: 'kept' }] }, 'metadata only excluded at root');
same({ z: [null, undefined, NaN, Infinity, -0, fn, Symbol('s')], a: { 10: 'ten', 2: 'two', '01': 'one', '4294967295': 'large', '-1': 'neg' }, omitted: undefined, f: fn }, 'nulls, numeric keys, functions');
same({ unicode: ['\ud800', '\udc00', '𐀀', 'é😀', '"\\\n\t\u0001'], k: { '\ud800key': 1, 'é': 2 } }, 'unicode and escapes');
same({ date: new Date(0), custom: new Custom(), map: new Map([[1, 2]]), inner: [new Date(0), new Custom()], protoNull: Object.assign(Object.create(null), { b: 1, a: 'x' }) }, 'non-plain objects');
same({ toJSONLeaf: { toJSON() { return 'no'; }, a: 1 }, arr: [[], {}, [[]], [{}]], empty: {} }, 'toJSON is ignored, empties');
same({ long: 'L'.repeat(4096), longer: 'M'.repeat(4097), huge: 'H'.repeat(70_000), leaf: { s: 'S'.repeat(4096), t: 'T'.repeat(4097) } }, 'string length boundaries');
same({ wide: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, 'w'.repeat(4000)])) }, 'a wide flat object stays chunk-bounded');
same(['top', 1, { a: [1, 2, { b: 3 }] }], 'root array');
same('root string', 'root string');
same(42, 'root number');

// ---- Fuzz ----
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const atoms = [() => null, () => undefined, () => Math.round(rnd() * 1e6) / 1e3, () => -0, () => NaN, () => rnd() > 0.5, () => 'abc'.repeat(Math.floor(rnd() * 5)), () => String.fromCharCode(0xd800 + Math.floor(rnd() * 2048)), () => fn];
const keyPool = ['a', 'b', 'savedAt', 'page', '0', '10', '2', '01', 'x y', 'é', 'lastSavedAt'];
function gen(depth) {
  const r = rnd();
  if (depth > 4 || r < 0.35) return atoms[Math.floor(rnd() * atoms.length)]();
  if (r < 0.65) return Array.from({ length: Math.floor(rnd() * 5) }, () => gen(depth + 1));
  const o = {}; for (let i = Math.floor(rnd() * 6); i > 0; i--) o[keyPool[Math.floor(rnd() * keyPool.length)]] = gen(depth + 1);
  return o;
}
for (let i = 0; i < 3000; i++) same(gen(0), `fuzz case ${i}`);

// ---- Compatibility with the existing signature, checksum and byte length ----
for (const value of [{ jobId: 'j', savedAt: 'ignored', rows: [{ quantity: 1, label: 'x' }] }, { a: { 10: 'ten', 2: 'two' }, b: [1, null, 'é'] }]) {
  const legacy = jobContentSignature(value);
  assert.equal([...jobJsonChunks(value)].join(''), legacy);
  assert.equal(await jobChecksum(value), createHash('sha256').update(legacy).digest('hex'));
  assert.equal(jobJsonByteLength(value), Buffer.byteLength(JSON.stringify(value)));
}

// ---- A real saved job, when the recovered copy is on this machine ----
const realJob = 'recovery/ai-takeoff-run-2026-10-06/takeoff-with-ai-run.decoded.json';
if (fs.existsSync(realJob)) { same(JSON.parse(fs.readFileSync(realJob, 'utf8')), 'recovered New Job 03/09'); console.log('Real saved job serializes identically.'); }

// ---- Performance: 19 sheets of compact PDF linework ----
const segments = (n) => Array.from({ length: n }, (_, i) => ({ x1: i * 0.5, y1: i * 0.25, x2: i * 0.5 + 3.125, y2: i * 0.25, path: i % 97, subpath: i % 13, curve: i % 11 === 0 }));
const vectorJob = { jobId: 'perf', aiPlanTakeoffJob: { plan: { pages: Array.from({ length: 19 }, (_, p) => ({ pageNumber: p + 1, logicalWidth: 1190.55, logicalHeight: 841.89, vectorSegments: segments(30000) })) } } };
const started = Date.now();
const checksum = await jobChecksum(vectorJob);
const bytes = jobJsonByteLength(vectorJob);
const elapsed = Date.now() - started;
const legacyText = [...reference(vectorJob)].join('');
assert.equal(checksum, createHash('sha256').update(legacyText).digest('hex'), 'vector job checksum unchanged');
assert.equal(bytes, Buffer.byteLength(JSON.stringify(vectorJob)));
console.log(`19 sheets x 30,000 segments: checksum + byte length in ${elapsed} ms (${(bytes / 1e6).toFixed(1)} MB).`);
assert.ok(elapsed < 15000, `large vector job serializes in reasonable time (${elapsed} ms)`);
console.log('PASS: flat-leaf fast path is byte-identical to the original serializer (edge cases, 3000 fuzz cases) and bounded.');
