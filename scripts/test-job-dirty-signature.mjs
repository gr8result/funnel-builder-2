import assert from 'node:assert/strict';
import { jobDirtySignature, jobContentSignature } from '../lib/construction-estimation/jobPersistence.js';

const plan = { pages: [{ dataUrl: `data:image/png;base64,${'A'.repeat(8_000_000)}` }] };
const book = { rooms: [{ name: 'Kitchen', rows: [{ quantity: 2, colour: 'Oak' }] }] };
const job = { jobId: 'memory-test', plan, clientSelectionsBook: book, selectionsBook: book, quotation: {}, savedAt: 'old' };
const before = jobDirtySignature(job);
assert.equal(before.length, 32, 'Dirty markers must not retain embedded assets');
assert.equal(jobDirtySignature(structuredClone(job)), before, 'Equivalent loaded jobs have the same marker');
assert.equal(jobDirtySignature({ ...job, savedAt: 'new', page: 'clientSelections' }), before);
assert.equal(jobDirtySignature({ ...job, selectionsBook: structuredClone(book) }), before, 'Alias identity does not alter content');
for (const changed of [
  { ...job, quotation: { added: { quantity: 1 } } },
  { ...job, clientSelectionsBook: { rooms: [{ name: 'Kitchen', rows: [{ quantity: 3, colour: 'Oak' }] }] } },
  { ...job, plan: { pages: [{ dataUrl: plan.pages[0].dataUrl.slice(0, -1) + 'B' }] } },
  { ...job, futureExtension: { value: 0 } },
]) assert.notEqual(jobDirtySignature(changed), before, 'Every saved module and same-length asset edit must mark dirty');
assert.notEqual(jobDirtySignature({ value: '1' }), jobDirtySignature({ value: 1 }));
assert.notEqual(jobDirtySignature({ list: [1, 2] }), jobDirtySignature({ list: [2, 1] }));
assert.equal(jobDirtySignature({ b: 2, a: 1 }), jobDirtySignature({ a: 1, b: 2 }));
assert(jobContentSignature(job).length > 8_000_000, 'Existing canonical storage checksum representation remains compatible');
console.log('PASS compact dirty signatures: assets, aliases, immutable edits, order, types and checksum compatibility.');
