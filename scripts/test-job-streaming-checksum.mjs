import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { jobContentSignature } from '../lib/construction-estimation/jobPersistence.js';
import { jobChecksum, jobJsonChunks, jobJsonByteLength, snapshotJob } from '../lib/construction-estimation/jobSerialization.js';

const asset = 'A'.repeat(16382) + '😀' + '\ud800' + '\n"\\' + 'B'.repeat(8_000_000);
const cases = [
  { jobId: 'large', savedAt: 'ignored', page: 'ignored', plan: { dataUrl: asset }, nested: { savedAt: 'included' } },
  { z: [null, undefined, NaN, Infinity, -0], a: { 10: 'ten', 2: 'two', '01': 'one', '4294967295': 'large' }, omitted: undefined },
  { unicode: '\ud800\udc00\udfffé😀', quotation: {}, aliases: [{ value: 1 }, { value: 1 }] },
];
for (const value of cases) {
  const legacy = jobContentSignature(value);
  assert.equal([...jobJsonChunks(value)].join(''), legacy);
  assert.equal(await jobChecksum(value), createHash('sha256').update(legacy).digest('hex'), 'Existing checksums remain compatible');
  assert.equal(jobJsonByteLength(value), Buffer.byteLength(JSON.stringify(value)));
  assert(Math.max(...[...jobJsonChunks(value)].map(chunk => chunk.length)) < 100_000, 'No whole asset serialization');
}
console.log('PASS: bounded serialization matches existing SHA-256 and byte counts, including Unicode boundaries and numeric keys.');
const book = { rows: [{ quantity: 1 }], image: asset };
const job = { book, alias: book };
const captured = snapshotJob(job);
book.rows[0].quantity = 2;
assert.equal(captured.book.rows[0].quantity, 1, 'Pending saves capture edits before yielding');
assert.equal(captured.alias, captured.book, 'Shared workbook branches stay shared');
assert.equal(captured.book.image, asset, 'Immutable assets survive exactly');
