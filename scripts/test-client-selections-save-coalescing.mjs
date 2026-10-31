import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the hook's actual coordinator with a stalled first persistence call.
// Five further edits must leave one latest book pending, and every caller settles.
const source = fs.readFileSync('hooks/estimate-builder/useEstimateBuilderWorkbook.js', 'utf8');
const coordinator = source.slice(source.indexOf('  function updateClientSelectionsBook('), source.indexOf('  async function saveClientSelectionsBook('));
const pending = { current: null }, running = { current: false };
const started = [], completions = [];
let active = 0, maximum = 0;
const save = { current: async book => {
  started.push(book.version); active++; maximum = Math.max(maximum, active);
  await new Promise(resolve => completions.push(resolve));
  active--;
  return { ok: true, version: book.version };
} };
const update = new Function('clientSelectionsSavePendingRef', 'clientSelectionsSaveRunningRef', 'saveClientSelectionsBookRef', 'setAutosaveCompletion', `${coordinator}; return updateClientSelectionsBook;`)(pending, running, save, () => {});
const results = Array.from({ length: 6 }, (_, index) => update(Object.freeze({ version: index + 1 })));
assert.deepEqual(started, [1]);
assert.equal(pending.current.bookForSave.version, 6);
assert.equal(results[1], results[5], 'Superseded edits share one pending promise, not an accumulating waiter list');
completions.shift()();
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(started, [1, 6], 'Intermediate edits must not trigger more full-job saves');
completions.shift()();
const saved = await Promise.all(results);
assert.deepEqual(saved.map(result => result.version), [1, 6, 6, 6, 6, 6]);
assert.equal(maximum, 1);
assert.equal(pending.current, null);
assert.equal(running.current, false);
console.log('PASS: six edits, one active save, one latest pending save, all callers resolved, empty queue.');
