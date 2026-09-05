import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/takeoff-recovery-worker.js', 'utf8');
const context = vm.createContext({ self: {}, TextEncoder, Blob });
vm.runInContext(source + '\nself.serialize = value => [...jsonTokens(value)].join("");', context);
const result = vm.runInContext(`(() => {
  const value = { text: 'x'.repeat(16383) + '😀' + '\\n"\\\\' + 'y'.repeat(70000), sparse: [1,,undefined,3], nested: { a: true, b: null } };
  return { actual: self.serialize(value), expected: JSON.stringify(value) };
})()`, context);
assert.equal(result.actual, result.expected, 'Chunked export must preserve Unicode, escapes and arrays.');
assert.throws(() => vm.runInContext('self.serialize(new Blob(["test"]))', context), /Non-JSON/);
assert(!/\.getAll\(/.test(source));
assert(!/\.delete\(|\.clear\(/.test(source));
const listBody = source.slice(source.indexOf('async function list('), source.indexOf('let running ='));
assert(!listBody.includes('readRecord('), 'Opening safe mode must never fetch a legacy record value.');
assert(listBody.includes('openKeyCursor'), 'Opening safe mode reads keys first.');
const route = fs.readFileSync('pages/modules/estimate-builder/index.js', 'utf8');
assert(route.indexOf('return <TakeoffRecoveryPanel') < route.indexOf('<EstimateBuilderWorkbook'));
const normal = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', 'utf8');
assert(!normal.includes('loadJobData(initialJob,'));
console.log('Recovery contracts passed: chunked JSON round-trip, unsupported-value failure, read-only source storage, keys-only mount, route interlock, no initial hydration.');
