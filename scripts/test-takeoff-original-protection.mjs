import assert from 'node:assert/strict';
import { persistCompleteJob } from '../lib/construction-estimation/jobPersistence.js';

for (const initializeRecovery of [false, true]) {
  let databaseOpened = false;
  let externalized = false;
  await assert.rejects(persistCompleteJob({
    key: 'job:03-09/123',
    workbook: { jobId: '03-09/123' },
    initializeRecovery,
    openDatabase: async () => { databaseOpened = true; throw new Error('Unexpected database access'); },
    externalize: async value => { externalized = true; return value; },
  }), /Original records cannot be overwritten/);
  assert.equal(databaseOpened, false, 'Protect original before any database write');
  assert.equal(externalized, false, 'Protect original before any plan-asset conversion');
}
console.log('PASS: direct and recovery-initialization saves cannot write the original or convert its assets.');
