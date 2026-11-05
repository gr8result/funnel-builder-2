// The job checksum is identical whether the browser's native SHA-256 or the JavaScript fallback computes
// it (insecure contexts have no crypto.subtle), so jobs saved either way verify either way.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { jobChecksum } from '../lib/construction-estimation/jobSerialization.js';

const job = { jobId: 'j-1', data: { rows: Array.from({ length: 4000 }, (_, i) => ({ i, name: `Row ${i} – ünïcode`, v: i / 7 })) },
  quotation: { lines: [{ a: 1, b: 'x'.repeat(70000) }] }, '10': 'numeric key', '2': true, updatedAt: 'excluded metadata' };
const native = await jobChecksum(job);
const realCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
let fallback;
try { fallback = await jobChecksum(job); } finally { Object.defineProperty(globalThis, 'crypto', realCrypto); }
assert.match(native, /^[0-9a-f]{64}$/);
assert.equal(native, fallback, 'native and JavaScript SHA-256 give the same job checksum');
// A failing native digest falls back rather than failing the save.
const failing = { digest: () => Promise.reject(new Error('not allowed')) };
Object.defineProperty(globalThis, 'crypto', { value: { subtle: failing }, configurable: true });
try { assert.equal(await jobChecksum(job), native, 'a failing native digest falls back to the same result'); } finally { Object.defineProperty(globalThis, 'crypto', realCrypto); }
assert.notEqual(createHash('sha256').update('x').digest('hex'), native);
console.log('PASS: native and JavaScript job checksums are identical; a failing native digest falls back.');
